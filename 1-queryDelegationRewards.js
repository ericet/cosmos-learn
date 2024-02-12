import {
    QueryClient, setupDistributionExtension

} from "@cosmjs/stargate";
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';

async function getQueryClient (rpcEndpoint) {
    const tendermint34Client = await Tendermint34Client.connect(rpcEndpoint);
    const queryClient = QueryClient.withExtensions(
        tendermint34Client,
        setupDistributionExtension
    );
    return queryClient;
}


async function start (address) {
    const rpcEndpoint = "https://rpc.cosmos.network";
    const queryClient = await getQueryClient(rpcEndpoint);
    let rewards = await queryClient.distribution.delegationTotalRewards(address);
    let totalRewards = 0;
    let validators = [];
    for (let reward of rewards.rewards) {
        validators.push(reward.validatorAddress);
        console.log(reward)
        totalRewards += Number(reward.reward[0].amount) / 1e24;
    }
    console.log("Pending rewards: " + totalRewards);

}
const address = '';//enter cosmos address
start(address);