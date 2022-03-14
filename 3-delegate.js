import {
    QueryClient, setupDistributionExtension,SigningStargateClient

} from "@cosmjs/stargate";
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { coin,coins, Secp256k1HdWallet } from '@cosmjs/launchpad'


async function getQueryClient(rpcEndpoint) {
    const tendermint34Client = await Tendermint34Client.connect(rpcEndpoint);
    const queryClient = QueryClient.withExtensions(
        tendermint34Client,
        setupDistributionExtension
    );
    return queryClient;
}

async function delegate(client, address, validators, amount) {
    let ops=[];
    ops.push({
        typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
        value: {
            delegatorAddress: address,
            validatorAddress: validators[0],
            amount: coin(amount, "uatom")
        },
    });
    const fee = {
        amount: coins(0, "uatom"),
        gas: "300000",
    };
    let result = await client.signAndBroadcast(address, ops, fee, '');
    console.log("Broadcasting result:", result);

}




async function start(mnemonic) {
    const rpcEndpoint = "https://rpc.cosmos.network";
    const wallet = await Secp256k1HdWallet.fromMnemonic(
        mnemonic
    );
    const [account] = await wallet.getAccounts();
    const queryClient = await getQueryClient(rpcEndpoint);
    let rewards = await queryClient.distribution.delegationTotalRewards(account.address);
    let validators = [];
    for (let reward of rewards.rewards) {
        validators.push(reward.validatorAddress);
    }
    const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, wallet);
    await delegate(client,account.address, validators, amount);
   
}
const mnemonic = "";//enter mnemonic
const amount = 100000
start(mnemonic,amount);