import {
    QueryClient, setupDistributionExtension, setupBankExtension, setupStakingExtension, setupTxExtension, setupGovExtension, SigningStargateClient, calculateFee
} from "@cosmjs/stargate";
import {
    PrivateKey,
    InjectiveDirectEthSecp256k1Wallet
} from "@injectivelabs/sdk-ts"
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import fs from "fs";
import EthermintSigningClient from "./utils/EthermintSigningClient.js";
import { validateMnemonic } from 'bip39';
import { Secp256k1HdWallet } from '@cosmjs/launchpad';

const loadJSON = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const chainsMap = loadJSON('./assets/chains.json');

async function getQueryClient (rpcEndpoint) {
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

function hasVoted (client, proposalId, address) {
    return new Promise(async (resolve) => {
        client.gov.vote(proposalId, address).then(res => {
            resolve(res)
        }).catch(err => {
            resolve(false)
        })
    })
}


async function vote (client, address, proposalId, option,chain) {
    let ops = [];
    ops.push({
        typeUrl: "/cosmos.gov.v1beta1.MsgVote",
        value: {
            proposalId: proposalId,
            voter: address,
            option: option
        },
    });
    let result;
    if (chain.slip44 && chain.slip44 === 60) {
        result = await client.signAndBroadcast(address, ops, '', '');
    } else {
        let calculatedFee = await estimateFee(client, address, ops, chain);
        result = await client.signAndBroadcast(address, ops, calculatedFee, '');
    }
    return result;
}
async function estimateFee (client, address, message, chain) {
    try {
        let gasLimit = await client.simulate(address, message, '');
        let calculatedFee = calculateFee(Math.floor(gasLimit * chain.gasLimitRatio), `${chain.gasPrice}${chain.denom}`);
        return calculatedFee;
    } catch (err) {
        console.log("Error in estimateFee: " + err);
    }
}
async function start (chain, mnemonicOrKey, proposalId, option) {
    try {
        const rpcEndpoint = chain.rpc;
        let wallet, client;
        let isMnemonic = validateMnemonic(mnemonicOrKey);
        if (chain.slip44 && chain.slip44 === 60) {
            if (isMnemonic) {
                const privateKeyFromMnemonic = PrivateKey.fromMnemonic(mnemonicOrKey)
                wallet = (await InjectiveDirectEthSecp256k1Wallet.fromKey(
                    Buffer.from(privateKeyFromMnemonic.toPrivateKeyHex().replace("0x", ""), "hex"), chain.prefix))
            } else {
                wallet = (await InjectiveDirectEthSecp256k1Wallet.fromKey(
                    Buffer.from(mnemonicOrKey, "hex"), chain.prefix));

            }
            client = new EthermintSigningClient(chain, wallet);
        } else {
            wallet = await Secp256k1HdWallet.fromMnemonic(
                mnemonicOrKey,
                { prefix: chain.prefix }
            );
            client = await SigningStargateClient.connectWithSigner(rpcEndpoint, wallet);
        }
        const [account] = await wallet.getAccounts();
        const queryClient = await getQueryClient(rpcEndpoint);
        let balances = await queryClient.bank.balance(account.address, chain.denom);
        console.log(`${account.address} has ${balances.amount / Math.pow(10, chain.exponent)} ${chain.symbol}`);
        if (balances.amount > 0) {
            let voted = await hasVoted(queryClient, proposalId, account.address);
            if (!voted) {
                let result = await vote(client, account.address, proposalId, option,chain);
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
