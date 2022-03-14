const API = 'https://cosmoshub.stakesystems.io/';
import fetch from 'node-fetch';
import { decodeTxRaw } from "@cosmjs/proto-signing"
import { fromBase64,toHex} from "@cosmjs/encoding";
import { sha256 } from '@cosmjs/crypto';
let nextBlockNum = 0;

async function getLatestBlock() {
    return new Promise((resolve) => {
        fetch(API + "/blocks/latest").then(res => {
            resolve(res.json());
        });
    })
}

async function getBlockByHeight(height) {
    return new Promise((resolve) => {
        fetch(API + `/blocks/${height}`).then(res => {
            resolve(res.json());
        });
    })
}

async function getTxs(hash){
    return new Promise((resolve) => {
        fetch(API + `/txs/${hash}`).then(res => {
            resolve(res.json());
        });
    })
}


const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function loadNextBlock() {
    getLatestBlock().then(res => {
        const { height } = res.block.header;
        if (height >= nextBlockNum) {
            console.log(nextBlockNum);
            loadBlock(nextBlockNum);
            nextBlockNum++;
        } else {
            sleep(3000).then(() => {
                console.log(
                    'Waiting for the latest block',
                    height,
                    'now nextBlockNum',
                    nextBlockNum,
                );
                loadNextBlock();
            })
        }
    }).catch(err => {
        console.error("Call api failed", err);
        sleep(3000).then(() => {
            console.log('Retry loadNextBlock', nextBlockNum);
            loadNextBlock();
        });
    })
}

async function loadBlock(blockNum) {
    getBlockByHeight(blockNum).then(res => {
        let txs = res.block.data.txs;
        for (let tx of txs) {
           
            let transaction = decodeTxRaw(fromBase64(tx));
            let messages = transaction.body.messages;
            for(let message of messages){
                let type = message.typeUrl;
                let value = message.value;
                if(type == '/cosmos.staking.v1beta1.MsgDelegate'){
                    let hash = toHex(sha256(fromBase64(tx))).toUpperCase();
                    getTxs(hash).then(res=>{
                        let messages = res.tx.value.msg
                        for(let message of messages){
                            console.log(message.type);
                        }
                    })
                }
            }
        }
        loadNextBlock();
    })

}

async function start() {
    getLatestBlock().then(res=>{
        const { height } = res.block.header;
        nextBlockNum=height-1;
        loadBlock(nextBlockNum);
    })
}


start();