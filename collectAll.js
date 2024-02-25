import {
    QueryClient, setupDistributionExtension, setupBankExtension, setupStakingExtension, setupTxExtension, setupGovExtension
} from "@cosmjs/stargate";
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import fs from "fs";
import SigningClient from "./utils/SigningClient.js";
import { getSigner } from "./utils/helpers.js";
import { coins } from '@cosmjs/launchpad';
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


async function transfer(client, chain, from, recipient, amount) {
    let ops = [];
    let msg = {
        typeUrl: "/cosmos.bank.v1beta1.MsgSend",
        value: {
            fromAddress: from,
            toAddress: recipient,
            amount: coins(amount, chain.denom)
        },
    };
    ops.push(msg);
    let result = await client.signAndBroadcast(from, ops, '', '');
    return result;
}

async function start(chain, mnemonicOrKey, recipient) {
    try {
        const rpcEndpoint = chain.rpc;
        let wallet = await getSigner(chain, mnemonicOrKey);
        let client = new SigningClient(chain, wallet);
        const [account] = await wallet.getAccounts();
        const queryClient = await getQueryClient(rpcEndpoint);
        let balances = await queryClient.bank.balance(account.address, chain.denom);
        console.log(`${account.address} has ${balances.amount / Math.pow(10, chain.exponent)} ${chain.symbol}`);
        if (balances.amount > 0) {
            let transferAmount = balances.amount - chain.collect_min * Math.pow(10, chain.exponent);
            console.log(`Transferring ${transferAmount / Math.pow(10, chain.exponent)} ${chain.symbol} to ${recipient}`);
            let result = await transfer(client, chain, account.address, recipient,transferAmount);
            let code = result.code;
            if (code == 0) {
                console.log(`${account.address} transferred ${transferAmount / Math.pow(10, chain.exponent)} ${chain.symbol} to ${recipient}: ${result.transactionHash}`)
            } else {
                console.log(`${account.address} FAILED to transfer ${transferAmount / Math.pow(10, chain.exponent)} ${chain.symbol} to ${recipient}. Reason: ${result.rawLog}`);
            }
        }
    } catch (err) {
        console.log(err)
        console.log("Error in start: " + err);
    }
}



const mnemonicOrKey = 'Put mnemonic or private key here';
const recipient = ''; //Recipient

for (let chainName in chainsMap) {
    start(chainsMap[chainName], mnemonicOrKey, recipient, collectMin);
}