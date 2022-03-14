import { SigningStargateClient } from "@cosmjs/stargate";
import pkg from '@cosmjs/launchpad';

async function multiSend(client, from, recipients) {
    let ops = [];
    for (let recipient of recipients) {
        let msg = {
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: {
                fromAddress: from,
                toAddress: recipient,
                amount: pkg.coins(10000, "uatom")
            },
        };
        ops.push(msg);
    }
    const fee = {
        amount: pkg.coins(800, "uatom"),
        gas: "180000",
    };
    let result = await client.signAndBroadcast(from, ops, fee, '');
    console.log("Broadcasting result:", result);

}

async function start() {
    const mnemonic = "";//enter mnemonic
    const addresses =[""];//enter addresses
    const rpcEndpoint = "https://rpc.cosmos.network";
    const wallet = await pkg.Secp256k1HdWallet.fromMnemonic(
        mnemonic
    );
    const [account] = await wallet.getAccounts();
    
    const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, wallet);
    multiSend(client, account.address, addresses)
}

start();