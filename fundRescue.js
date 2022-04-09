import pkg from '@cosmjs/launchpad';
import {
    QueryClient, setupBankExtension, SigningStargateClient

} from "@cosmjs/stargate";
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import axios from 'axios';
import { chainMap } from "./assets/chains.js";
import { createInterface } from "readline";
import { validateMnemonic } from 'bip39';

let API = '';
async function getUnbondingDelegations(address) {
    return new Promise((resolve) => {
        axios.get(`${API}/cosmos/staking/v1beta1/delegators/${address}/unbonding_delegations`).then(res => {
            if (res.data.unbonding_responses.length > 0) {
                let unbondingResponse = res.data.unbonding_responses[0];
                let completion = unbondingResponse.entries[0].completion_time;
                resolve(new Date(completion).getTime());
            } else {
                resolve(0)
            }
        }).catch(err => {
            resolve(0)
        })
    })
}
async function getQueryClient(rpcEndpoint) {
    const tendermint34Client = await Tendermint34Client.connect(rpcEndpoint);
    const queryClient = QueryClient.withExtensions(
        tendermint34Client,
        setupBankExtension
    );
    return queryClient;
}

async function transfer(client, chain, from, recipient, amount) {
    let ops = [];
    let msg = {
        typeUrl: "/cosmos.bank.v1beta1.MsgSend",
        value: {
            fromAddress: from,
            toAddress: recipient,
            amount: pkg.coins(amount, chain.denom)
        },
    };
    ops.push(msg);
    const fee = {
        amount: pkg.coins(10000, chain.denom),
        gas: "200000",
    };
    let result = await client.signAndBroadcast(from, ops, fee, '');
    if (result.code > 0) {
        console.log("Failed. Please try again. " + result.rawLog);
    } else {
        console.log("Your fund is in safe place now. Tx Hash: " + result.transactionHash);
    }
    process.exit(0);

}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function timeLeft(timeLeft) {
    let days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    let hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    let minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    let seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    return `${days} Days, ${hours} Hours, ${minutes} Mins, ${seconds} secs`
}

async function start(chain, mnemonic, recipient) {
    const queryClient = await getQueryClient(chain.rpc);
    const wallet = await pkg.Secp256k1HdWallet.fromMnemonic(
        mnemonic,{
            prefix: chain.prefix
        }
    );
    API=chain.rest;
    const [account] = await wallet.getAccounts();
    console.log(account.address)
    let completion = await getUnbondingDelegations(account.address);
    let current = new Date().getTime();
    let diff = completion - current;
    //if completion time is less than 10 minutes
    while (diff > 10 * 60 * 1000) {
        current = new Date().getTime();
        diff = completion - current;
        console.log(timeLeft(diff) + " until unbonding completion");
        await sleep(60 * 1000);
    }
    let balance = await queryClient.bank.balance(account.address, chain.denom);
    while (Number(balance.amount) / 1e6 < 0.1) {
        await sleep(1000);
        console.log(`Your account has ${balance.amount / 1e6} ${chain.symbol}`);
        balance = await queryClient.bank.balance(account.address, chain.denom);
       
    }
    const client = await SigningStargateClient.connectWithSigner(chain.rpc, wallet);
    console.log(`Ready to transfer ${balance.amount / 1e6} ${chain.symbol} to ${recipient}`);
    transfer(client,chain, account.address, recipient, Number(balance.amount) - 10000);
}


const readline = createInterface({
    input: process.stdin,
    output: process.stdout
});
readline.question("Please enter your mnemonic:\n", async (mnemonic) => {
    if(!validateMnemonic(mnemonic)){
        console.log("Not a valid mnemonic!")
        process.exit(0);
    }
    readline.question("Please enter the recipient:\n", async (recipient) => {
        readline.question("Please select a chain(Enter number):\n1: Cosmos\n2: Osmosis\n3: Juno\n", async (option) => {
            if(option==1){
                start(chainMap['cosmoshub-4'],mnemonic,recipient);
            }else if(option ==2){
                start(chainMap['osmosis-1'],mnemonic,recipient);
            }else if(option==3){
                start(chainMap['juno-1'],mnemonic,recipient);
            }else{
                console.log("Wrong selection!");
                process.exit(0);
            }
        });
    });
});

