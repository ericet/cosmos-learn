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

function hasVoted(client, proposalId, address) {
    return new Promise(async (resolve) => {
        client.gov.vote(proposalId, address).then(res => {
            resolve(res)
        }).catch(err => {
            resolve(false)
        })
    })
}

async function voteProposal(client, chain, proposalId, address, option) {
    let ops = [];
    let msg = {
        typeUrl: "/cosmos.gov.v1beta1.MsgVote",
        value: {
            proposalId: proposalId,
            voter: address,
            option: option
        },
    };
    ops.push(msg);

    const fee = {
        amount: coins(0, chain.denom),
        gas: "" + chain.gas,
    };
    console.log(`${address} is ready to vote on proposal #${proposalId}`);
    let result = await client.signAndBroadcast(address, ops, fee, '');
    console.log(result)
    if (result.code == 0) {
        console.log(`${address} voted proposal #${proposalId}`);
    } else {
        console.log(`${address} failed to vote on proposal #${proposalId}`);
    }

}


async function start(mnemonic, chain) {
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
    if (Number(balance.amount) / 1e6 > 0.1) {
        const proposalsVoting = await queryClient.gov.proposals(statusVoting, "", "");
        for (let proposal of proposalsVoting.proposals) {
            let proposalId = proposal.proposalId.toString();
            let voted = await hasVoted(queryClient, proposalId, account.address);
            if (!voted) {
                await voteProposal(client, chain, proposalId, account.address, VOTE_OPTION_YES);
            }
        }
    }

}

let keys = process.env.MNEMONICS.split(',');
for (const [k, chain] of Object.entries(chainMap)) {
    for (let key of keys) {
        start(key, chain);
    }
}
