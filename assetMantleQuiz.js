import { Secp256k1HdWallet } from "@cosmjs/amino";
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();



function getSignature(signer, address, msg) {
    return new Promise(async (resolve) => {
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
                        signer: address,
                        data: Buffer.from(msg).toString("base64"),
                    },
                },
            ],
            memo: "",
        };

        const res = await signer.signAmino(address, signDoc);
        resolve(res.signature.signature)
    })
}
function hasCompleted(address) {
    return new Promise(async (resolve) => {
        axios.get('https://cosmos-stakedrop.assetmantle.one/qna/' + address).then(res => {
            if (res.data.success) {
                resolve(true)
            } else {
                resolve(false)
            }
        }).catch(err => {
            resolve(false);
        })
    })
}

function completeQuiz(address, signature, msg, publicKey) {
    return new Promise((resolve) => {
        axios.post('https://cosmos-stakedrop.assetmantle.one/qna', {
            publicKey: publicKey,
            signature: signature,
            signedData: msg
        }).then(res => {
            console.log(res.data);
            if (res.data.success) {
                console.log(`${address} completed the quiz`)
                resolve(true)
            } else {
                console.log(`${address} not able to complete the quiz`)
                resolve(false)
            }
        }).catch(err => {
            console.log(err.response)
            resolve(false)
        })
    })
}

let keys = process.env.MNEMONICS.split(',');
const msg = '1_c,2_b,3_a';
for (let key of keys) {
    const signer = await Secp256k1HdWallet.fromMnemonic(key);
    const account = (await signer.getAccounts())[0];
    let completed = await hasCompleted(account.address);
    if (!completed) {
        let signature = await getSignature(signer, account.address, msg);
        console.log(`${account.address} is completing the quiz...`)
        await completeQuiz(account.address, signature, msg, account.pubkey);
    }
}
