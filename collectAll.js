import {
    QueryClient, setupGovExtension, setupBankExtension, SigningStargateClient

} from "@cosmjs/stargate";
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { coins, Secp256k1HdWallet } from '@cosmjs/launchpad'
import dotenv from 'dotenv';
import { chainMap } from "./assets/chains.js";
dotenv.config();

const statusVoting = 2; //Voting Period

const VOTE_OPTION_UNSPECIFIED = 0; //no-op
const VOTE_OPTION_YES = 1; //YES
const VOTE_OPTION_ABSTAIN = 2;//abstain
const VOTE_OPTION_NO = 3;//NO
const VOTE_OPTION_NO_WITH_VETO = 4;//No with veto

async function getQueryClient(rpcEndpoint) {
    const tendermint34Client = await Tendermint34Client.connect(rpcEndpoint);
    const queryClient = QueryClient.withExtensions(
        tendermint34Client,
        setupBankExtension,
        setupGovExtension
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
    const fee = {
        amount: coins(chain.min_tx_fee, chain.denom),
        gas: "" + chain.gas,
    };
    let result = await client.signAndBroadcast(from, ops, fee, '');
    if (result.code > 0) {
        console.log("Failed. Please try again. " + result.rawLog);
    } else {
        console.log(`Transferred ${amount / Math.pow(10, chain.exponent)} ${chain.symbol} to ${recipient}. Tx Hash: ` + result.transactionHash);
    }

}

async function start(mnemonic, chain, recipient) {
    const rpcEndpoint = chain.rpc;
    const wallet = await Secp256k1HdWallet.fromMnemonic(
        mnemonic,
        {
            prefix: chain.prefix
        }
    );
    const [account] = await wallet.getAccounts();
    const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, wallet);
    const queryClient = await getQueryClient(rpcEndpoint);
    let balance = await queryClient.bank.balance(account.address, chain.denom);
    if (Number(balance.amount) / Math.pow(10, chain.exponent) > chain.collect_min && account.address !== recipient) {
        let transferAmount = balance.amount - chain.collect_min * Math.pow(10, chain.exponent);
        console.log(`Transferring ${transferAmount / Math.pow(10, chain.exponent)} ${chain.symbol} to ${recipient}`);
        transfer(client, chain, account.address, recipient, transferAmount);
    }

}

let keys = process.env.MNEMONICS.split(',');

if (process.env.RECIPIENT) {
    for (let key of keys) {

        start(key, chainMap['cosmoshub-4'], process.env.RECIPIENT);
    }
}
else {
    console.log('Please fill in RECIPIENT');
}

