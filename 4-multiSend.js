import {
    QueryClient, setupDistributionExtension, setupBankExtension, setupStakingExtension, setupTxExtension, setupGovExtension, SigningStargateClient, calculateFee
} from "@cosmjs/stargate";
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import fs from "fs";
import EthermintSigningClient from "./utils/SigningClient.js";
import { coins } from '@cosmjs/launchpad';
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

async function multiSend(client, from, recipients, amount, chain) {
    let ops = [];
    for (let recipient of recipients) {
        let msg = {
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: {
                fromAddress: from,
                toAddress: recipient,
                amount: coins("" + amount * Math.pow(10, chain.exponent), chain.denom)
            },
        };
        ops.push(msg);
    }

    let result = await client.signAndBroadcast(from, ops, '', '');

    return result;

}

async function start(chain, mnemonicOrKey, recipients, transferAmount) {
    try {
        const rpcEndpoint = chain.rpc;
        let wallet = await getSigner(chain, mnemonicOrKey);
        let client = new EthermintSigningClient(chain, wallet);
        const [account] = await wallet.getAccounts();
        const queryClient = await getQueryClient(rpcEndpoint);
        let balances = await queryClient.bank.balance(account.address, chain.denom);
        console.log(`${account.address} has ${balances.amount / Math.pow(10, chain.exponent)} ${chain.symbol}`);

        if (balances.amount > 0) {
            console.log(`${account.address} is transferring ${transferAmount} ${chain.symbol} to ${recipients}...`)
            let result = await multiSend(client, account.address, recipients, transferAmount, chain);
            let code = result.code;
            if (code == 0) {
                console.log(`${account.address} transferred ${transferAmount} ${chain.symbol} to ${recipients}: ${result.transactionHash}`)
            } else {
                console.log(`${account.address} FAILED to transfer ${transferAmount} ${chain.symbol} to ${recipients}. Reason: ${result.rawLog}`);
            }

        }
    } catch (err) {
        console.log(err)
        console.log("Error in start: " + err);
    }
}


const chainName = 'cosmos'; //Get the chain name from the chains.json
const mnemonicOrKey = 'Put mnemonic or private key here';

const recipients = []; //Recipients
const amount = 1; //Transfer amount

start(chainsMap[chainName], mnemonicOrKey, recipients, amount);