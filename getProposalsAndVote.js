import {
    QueryClient, setupGovExtension, setupBankExtension, SigningStargateClient

} from "@cosmjs/stargate";
import { LCDClient, MnemonicKey, MsgVote,Fee } from '@terra-money/terra.js';

import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { coins, Secp256k1HdWallet } from '@cosmjs/launchpad'
import { stringToPath } from "@cosmjs/crypto";
import dotenv from 'dotenv';
import { chainMap } from "./assets/chains.js";
dotenv.config();

const statusVoting = 2; //Voting Period

const VOTE_OPTION_UNSPECIFIED = 0; //no-op
const VOTE_OPTION_YES = 1; //YES
const VOTE_OPTION_ABSTAIN = 2;//abstain
const VOTE_OPTION_NO = 3;//NO
const VOTE_OPTION_NO_WITH_VETO = 4;//No with veto
//0:low fee
//1:low fee or no fee
const MODE = 1;
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
        amount: coins(chain.min_tx_fee[MODE], chain.denom),
        gas: "" + chain.gas,
    };
    console.log(`${address} is ready to vote on ${chain.name} proposal #${proposalId}`);
    let result = await client.signAndBroadcast(address, ops, fee, '');
    if (result.code == 0) {
        console.log(`${address} voted ${chain.name} proposal #${proposalId}`);
    } else {
        console.log(`${address} failed to vote on ${chain.name} proposal #${proposalId}`);
    }

}

//For terra only
async function voteProposalTerra(terra, wallet, chain, proposalId, address, option) {
    const vote = new MsgVote(proposalId, address, option);
    let minFee = chain.min_tx_fee[MODE];
    const fee = new Fee(chain.gas,{uluna:minFee})
    console.log(`${address} is ready to vote on ${chain.name} proposal #${proposalId}`);
    wallet.createAndSignTx({
        msgs: [vote],
        fee:fee,
        memo: ''
    }).then(tx => terra.tx.broadcast(tx))
        .then(result => {
            console.log(`${address} voted ${chain.name} proposal #${proposalId}`);
        }).catch(err => {
            console.log(`${address} failed to vote on ${chain.name} proposal #${proposalId}`);
        });

}


async function start(mnemonic, chain) {
    const rpcEndpoint = chain.rpc;
    const wallet = await Secp256k1HdWallet.fromMnemonic(
        mnemonic,
        {
            hdPaths: chain.hd_path ? [stringToPath(chain.hd_path)] : undefined,
            prefix: chain.prefix
        }
    );

    const [account] = await wallet.getAccounts();
    try {
        const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, wallet);
        const queryClient = await getQueryClient(rpcEndpoint);
        let balance = await queryClient.bank.balance(account.address, chain.denom);
        if (Number(balance.amount) / 1e6 > 0.1) {
            const proposalsVoting = await queryClient.gov.proposals(statusVoting, "", "");
            for (let proposal of proposalsVoting.proposals) {
                let proposalId = proposal.proposalId.toString();
                let voted = await hasVoted(queryClient, proposalId, account.address);
                if (!voted) {
                    if (chain.name == "terra") {
                        const terra = new LCDClient({
                            URL: chain.rest,
                            chainID: chain.chain_id,
                        });
                        const mk = new MnemonicKey({
                            mnemonic: mnemonic
                        });
                        const wallet = terra.wallet(mk);
                        await voteProposalTerra(terra, wallet, chain, proposalId, account.address, VOTE_OPTION_YES);

                    } else {
                        await voteProposal(client, chain, proposalId, account.address, VOTE_OPTION_YES);
                    }
                }
            }
        }
    } catch (err) {
        console.log(`${account.address} vote failed. ${err.message}`);
    }

}

let keys = process.env.MNEMONICS.split(',');
for (const [k, chain] of Object.entries(chainMap)) {
    for (let key of keys) {
        start(key, chain);
    }
}
