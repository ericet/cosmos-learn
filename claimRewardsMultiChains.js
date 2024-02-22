import {
    QueryClient, setupDistributionExtension, setupBankExtension, setupStakingExtension, setupTxExtension, setupGovExtension
} from "@cosmjs/stargate";
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import fs from "fs";
import SigningClient from "./utils/SigningClient.js";
import { getSigner } from "./utils/helpers.js";

const loadJSON = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const chainsMap = loadJSON('./assets/chains.json');

async function getQueryClient(rpcEndpoint) {
    const tendermint34Client = await Tendermint34Client.connect(rpcEndpoint);
    const queryClient = QueryClient.withExtensions(
        tendermint34Client,
        setupBankExtension,
        setupStakingExtension,
        setupTxExtension,
        setupGovExtension,
        setupDistributionExtension
    );
    return queryClient;
}



async function withdrawRewards(client, address, validators) {
    let ops = [];
    for (let validator of validators) {
        let msg = {
            typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
            value: {
                delegatorAddress: address,
                validatorAddress: validator
            },
        };
        ops.push(msg);
    }
    let result = await client.signAndBroadcast(address, ops, '', '');

    return result;
}


async function start(chain, mnemonicOrKey) {
    try {
        const rpcEndpoint = chain.rpc;
        let wallet = await getSigner(chain, mnemonicOrKey);
        let client = new SigningClient(chain, wallet);
        const [account] = await wallet.getAccounts();
        const queryClient = await getQueryClient(rpcEndpoint);
        let balances = await queryClient.bank.balance(account.address, chain.denom);
        console.log(`${account.address} has ${balances.amount / Math.pow(10, chain.exponent)} ${chain.symbol}`);

        let rewards = await queryClient.distribution.delegationTotalRewards(account.address);
        let totalDelegated = 0;

        if (rewards.total.length > 0) {
            let validators = [];
            let totalRewards = rewards.total[rewards.total.length - 1].amount / Math.pow(10, chain.exponent + 18);
            console.log(`${account.address} has ${totalRewards} ${chain.symbol} rewards available to claim`);
            for (let reward of rewards.rewards) {
                validators.push(reward.validatorAddress);
                let delegation = await queryClient.staking.delegation(account.address, reward.validatorAddress);
                if (delegation.delegationResponse.balance.amount > 0) {
                    totalDelegated += delegation.delegationResponse.balance.amount / Math.pow(10, chain.exponent);
                    console.log(`${account.address} is currently delegating ${delegation.delegationResponse.balance.amount / Math.pow(10, chain.exponent)} ${chain.symbol} to ${reward.validatorAddress}`)
                }
            }
            if (rewards.total[rewards.total.length - 1].amount > chain.claim_min * Math.pow(10, chain.exponent + 18)) {
                console.log(`${account.address} is withdrawing ${totalRewards} ${chain.symbol}...`)
                let result = await withdrawRewards(client, account.address, validators);
                let code = result.code;
                if (code == 0) {
                    console.log(`${account.address} withdrawn rewards from ${validators}: ${result.transactionHash}`)
                } else {
                    console.log(`${account.address} FAILED to withdraw rewards from ${validators}. Reason: ${result.rawLog}`);
                }
            }
        }
        if (totalDelegated > 0) {
            console.log(`${account.address} Total Delegated ${totalDelegated} ${chain.symbol}`)
            console.log('\n')
        }
    } catch (err) {
        console.log(err)
        console.log("Error in start: " + err);
    }
}


const mnemonicOrKey = 'Put mnemonic or private key here';

for (let chainName in chainsMap) {
    start(chainsMap[chainName], mnemonicOrKey);
}
