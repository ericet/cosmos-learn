import {
    QueryClient, setupDistributionExtension,SigningStargateClient

} from "@cosmjs/stargate";
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { coins, Secp256k1HdWallet } from '@cosmjs/launchpad'


async function getQueryClient(rpcEndpoint) {
    const tendermint34Client = await Tendermint34Client.connect(rpcEndpoint);
    const queryClient = QueryClient.withExtensions(
        tendermint34Client,
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
    const fee = {
        amount: coins(800, "uatom"),
        gas: "180000",
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
    await withdrawRewards(client, account.address, validators);
   
}
const mnemonic = "";//enter mnemonic
start(mnemonic);