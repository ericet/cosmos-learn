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
import { coin, Secp256k1HdWallet } from '@cosmjs/launchpad';

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

async function delegate (client, address, validator, amount, chain) {
    let ops = [];
    ops.push({
        typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
        value: {
            delegatorAddress: address,
            validatorAddress: validator,
            amount: amount
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
async function start (chain, mnemonicOrKey, validatorAddress, delegationAmount) {
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
            //Delegation
            let result = await delegate(client, account.address, validatorAddress, coin("" + delegationAmount * Math.pow(10, chain.exponent), chain.denom), chain);
            let code = result.code;
            if (code == 0) {
                console.log(`${account.address} delegated ${delegationAmount} ${chain.symbol} to ${validatorAddress}: ${result.transactionHash}`)
            } else {
                console.log(`${account.address} FAILED to delegate ${delegationAmount} ${chain.symbol} to ${validatorAddress}. Reason: ${result.rawLog}`);
            }
        }

    } catch (err) {
        console.log(err)
        console.log("Error in start: " + err);
    }
}



const chainName = 'cosmos'; //Get the chain name from the chains.json
const mnemonicOrKey = 'Put mnemonic or private key here';
const validatorAddress = ''; //Validator address
const delegationAmount = 1; //Delegation amount

start(chainsMap[chainName], mnemonicOrKey, validatorAddress, delegationAmount);

