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
function getCompletedQuests(address) {
    return new Promise(async (resolve) => {
        axios.get('https://cosmos-stakedrop.assetmantle.one/qna/' + address).then(res => {
            if (res.data.success) {
                resolve(res.data.qaData)
            } else {
                resolve([])
            }
        }).catch(err => {
            resolve([]);
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
function arrayRemove(arr, value) {

    return arr.filter(function (ele) {
        return ele != value;
    });
}

let keys = process.env.MNEMONICS.split(',');


for (let key of keys) {
    let msg = ['1_c', '2_b', '3_a', '4_d', '5_b', '6_c', '7_c', '8_d', '9_c', '10_a', '11_b', '12_c', '13_c', '14_a', '15_a', '16_b', '17_a', '18_d'];
    const msg2 = ['1_c', '2_b', '3_a', '4_d', '5_b', '6_c', '7_c', '8_d', '9_c', '10_a', '11_b', '12_c', '13_c', '14_a', '15_a', '16_b', '17_a', '18_d'];
    const signer = await Secp256k1HdWallet.fromMnemonic(key);
    const account = (await signer.getAccounts())[0];
    let completedQuests = await getCompletedQuests(account.address);
    for (let quest of completedQuests) {
        for (let ans of msg2) {
            if (ans.split("_")[0] == "" + quest.QId) {
                msg = arrayRemove(msg, ans);
            }
        }
    }
    let answers = msg.join();
    if (msg.length > 0) {
        let signature = await getSignature(signer, account.address, answers);
        console.log(`${account.address} is completing the quiz...`)
        await completeQuiz(account.address, signature, answers, account.pubkey);
    }else{
        console.log(`${account.address} completed all the quests so far. `);
    }
}
