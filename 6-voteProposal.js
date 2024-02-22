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

function hasVoted(client, proposalId, address) {
    return new Promise(async (resolve) => {
        client.gov.vote(proposalId, address).then(res => {
            resolve(res)
        }).catch(err => {
            resolve(false)
        })
    })
}


async function vote(client, address, proposalId, option) {
    let ops = [];
    ops.push({
        typeUrl: "/cosmos.gov.v1beta1.MsgVote",
        value: {
            proposalId: proposalId,
            voter: address,
            option: option
        },
    });
    let result = await client.signAndBroadcast(address, ops, '', '');
    return result;
}

async function start(chain, mnemonicOrKey, proposalId, option) {
    try {
        const rpcEndpoint = chain.rpc;
        let wallet = await getSigner(chain, mnemonicOrKey);
        let client = new SigningClient(chain, wallet);
        const [account] = await wallet.getAccounts();
        const queryClient = await getQueryClient(rpcEndpoint);
        let balances = await queryClient.bank.balance(account.address, chain.denom);
        console.log(`${account.address} has ${balances.amount / Math.pow(10, chain.exponent)} ${chain.symbol}`);
        if (balances.amount > 0) {
            let voted = await hasVoted(queryClient, proposalId, account.address);
            if (!voted) {
                let result = await vote(client, account.address, proposalId, option);
                let code = result.code;
                if (code == 0) {
                    console.log(`${account.address} has voted the proposal: ${result.transactionHash}`)
                } else {
                    console.log(`${account.address} FAILED to vote the proposal. Reason: ${result.rawLog}`);
                }
            } else {
                console.log(`${account.address} has already voted`)
            }
        }
    } catch (err) {
        console.log(err)
        console.log("Error in start: " + err);
    }
}

const chainName = 'dymension';
const mnemonicOrKey = 'Put mnemonic or private key here';
const proposalId = 1; //Proposal ID
const option = 1; //Option: 0-No, 1-Yes

start(chainsMap[chainName], mnemonicOrKey, proposalId, option);
