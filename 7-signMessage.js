import { Secp256k1HdWallet } from "@cosmjs/amino";


const mnemonic = '';//Enter mnemonic
const msg = '';//Enter Message

const signer = await Secp256k1HdWallet.fromMnemonic(mnemonic);
const account = (await signer.getAccounts())[0];
const signDoc = {
    chain_id: "",
    account_number: "0",
    sequence: "0",
    fee: {
        gas: "0",
        amount: [],
    },
    msgs: [
        {
            type: "sign/MsgSignData",
            value: {
                signer: account.address,
                data: Buffer.from(msg).toString("base64"),
            },
        },
    ],
    memo: "",
};

const res = await signer.signAmino(account.address, signDoc);
console.log(res.signature.signature);