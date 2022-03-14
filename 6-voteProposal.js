import {
    SigningStargateClient
} from "@cosmjs/stargate";
import { coins, Secp256k1HdWallet } from '@cosmjs/launchpad'



async function voteProposal(client, proposalId, address, option) {
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
        amount: coins(800, "uatom"),
        gas: "180000",
    };
    let result = await client.signAndBroadcast(address, ops, fee, '');
    console.log("Broadcasting result:", result);

}


async function start(mnemonic) {
    const rpcEndpoint = "https://cosmoshub.validator.network/";
    const wallet = await Secp256k1HdWallet.fromMnemonic(
        mnemonic
    );
    const [account] = await wallet.getAccounts();
    const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, wallet);
    await voteProposal(client, "62", account.address, 1);

}
const mnemonic = "";//enter mnemonic
start(mnemonic);