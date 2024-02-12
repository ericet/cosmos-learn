import {
    QueryClient, setupDistributionExtension, setupBankExtension, setupStakingExtension, setupTxExtension, setupGovExtension, SigningStargateClient, calculateFee
} from "@cosmjs/stargate";
import {
    PrivateKey,
    InjectiveDirectEthSecp256k1Wallet
} from "@injectivelabs/sdk-ts"
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import fs from "fs";
import EthermintSigningClient from "./utils/EthermintSigningClient.js";
import { validateMnemonic } from 'bip39';
import { Secp256k1HdWallet } from '@cosmjs/launchpad'

const loadJSON = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const chainsMap = loadJSON('./assets/chains.json');

async function getQueryClient (rpcEndpoint) {
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



async function withdrawRewards (client, address, validators, chain) {
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
    let result;
    if (chain.slip44 && chain.slip44 === 60) {
        result = await client.signAndBroadcast(address, ops, '', '');
    } else {
        let calculatedFee = await estimateFee(client, address, ops, chain);
        result = await client.signAndBroadcast(address, ops, calculatedFee, '');
    }
    return result;
}


async function estimateFee (client, address, message, chain) {
    try {
        let gasLimit = await client.simulate(address, message, '');
        let calculatedFee = calculateFee(Math.floor(gasLimit * chain.gasLimitRatio), `${chain.gasPrice}${chain.denom}`);
        return calculatedFee;
    } catch (err) {
        console.log("Error in estimateFee: " + err);
    }
}
async function start (chain, mnemonicOrKey) {
    try {
        const rpcEndpoint = chain.rpc;
        let wallet, client;
        let isMnemonic = validateMnemonic(mnemonicOrKey);
        if (chain.slip44 && chain.slip44 === 60) {
            if (isMnemonic) {
                const privateKeyFromMnemonic = PrivateKey.fromMnemonic(mnemonicOrKey)
                wallet = (await InjectiveDirectEthSecp256k1Wallet.fromKey(
                    Buffer.from(privateKeyFromMnemonic.toPrivateKeyHex().replace("0x", ""), "hex"), chain.prefix))
            } else {
                wallet = (await InjectiveDirectEthSecp256k1Wallet.fromKey(
                    Buffer.from(mnemonicOrKey, "hex"), chain.prefix));

            }
            client = new EthermintSigningClient(chain, wallet);
        } else {
            wallet = await Secp256k1HdWallet.fromMnemonic(
                mnemonicOrKey,
                { prefix: chain.prefix }
            );
            client = await SigningStargateClient.connectWithSigner(rpcEndpoint, wallet);
        }
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
                let result = await withdrawRewards(client, account.address, validators, chain);
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


const chainName = 'cosmos';
const mnemonicOrKey = 'Put mnemonic or private key here';

start(chainsMap[chainName], mnemonicOrKey);