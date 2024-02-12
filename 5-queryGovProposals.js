import {
    QueryClient, setupGovExtension

} from "@cosmjs/stargate";
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import fs from "fs";
const loadJSON = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const chainsMap = loadJSON('./assets/chains.json');

const statusDeposit = 1;
const statusVoting = 2;
const statusPassed = 3;
const statusRejected = 4;

async function getQueryClient(rpcEndpoint) {
    const tendermint34Client = await Tendermint34Client.connect(rpcEndpoint);
    const queryClient = QueryClient.withExtensions(
        tendermint34Client,
        setupGovExtension
    );
    return queryClient;
}

async function start(chain) {
    const rpcEndpoint = chain.rpc;
    const queryClient = await getQueryClient(rpcEndpoint);
    const proposalsDeposit = await queryClient.gov.proposals(statusDeposit, "", "");
    console.log("Proposals deposit: ", proposalsDeposit);
    const proposalsVoting = await queryClient.gov.proposals(statusVoting, "", "");
    console.log("Proposals voting: ", proposalsVoting.proposals[0].proposalId.toString());
    const proposalsPassed = await queryClient.gov.proposals(statusPassed, "", "");
    console.log("Proposals passed: ", proposalsPassed);
    const proposalsRejected = await queryClient.gov.proposals(statusRejected, "", "");
    console.log("Proposals rejected: ", proposalsRejected);
}

start(chainsMap['cosmos']);