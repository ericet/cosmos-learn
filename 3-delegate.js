import {
    QueryClient, setupDistributionExtension,SigningStargateClient

} from "@cosmjs/stargate";
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { coin,coins, Secp256k1HdWallet } from '@cosmjs/launchpad';
import { chainMap } from "./assets/chains.js";

const MODE=1;

async function getQueryClient(rpcEndpoint) {
    const tendermint34Client = await Tendermint34Client.connect(rpcEndpoint);
    const queryClient = QueryClient.withExtensions(
        tendermint34Client,
        setupDistributionExtension
    );
    return queryClient;
}

async function delegate(client, address, validators, amount,chain) {
    let ops=[];
    ops.push({
        typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
        value: {
            delegatorAddress: address,
            validatorAddress: validators[0],
            amount: coin(amount, chain.denom)
        },
    });
    const fee = {
        amount: coins(chain.min_tx_fee[MODE], chain.denom),
        gas: "" + chain.gas,
    };
    let result = await client.signAndBroadcast(address, ops, fee, '');
    console.log("Broadcasting result:", result);

}




async function start(chain,mnemonic,amount) {
    const rpcEndpoint = chain.rpc;
    const wallet = await Secp256k1HdWallet.fromMnemonic(
        mnemonic,
        {
            prefix:chain.prefix
        }
    );
    const [account] = await wallet.getAccounts();
    const queryClient = await getQueryClient(rpcEndpoint);
    let rewards = await queryClient.distribution.delegationTotalRewards(account.address);
    let validators = [];
    for (let reward of rewards.rewards) {
        validators.push(reward.validatorAddress);
    }
    const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, wallet);
    await delegate(client,account.address, validators, amount,chain);
   
}
const mnemonic = "";//enter mnemonic
const amount = 100000
start(chainMap['cosmoshub-4'],mnemonic,amount);