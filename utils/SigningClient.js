import _ from 'lodash'
import axios from 'axios'
import { multiply, ceil, bignumber, format, floor } from 'mathjs'
import Long from "long";

import {
    defaultRegistryTypes as defaultStargateTypes,
    assertIsDeliverTxSuccess,
    GasPrice,
    coin as _coin
} from "@cosmjs/stargate";
import { makeSignDoc, Registry } from "@cosmjs/proto-signing";
import { toBase64, fromBase64 } from '@cosmjs/encoding'
import { PubKey } from "cosmjs-types/cosmos/crypto/secp256k1/keys.js";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing.js";
import { AuthInfo, Fee, TxBody, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";


function EthermintSigningClient (network, signer) {

    const defaultGasPrice = network.gasPrice
    const { rest: restUrl, gasLimitRatio: defaultGasModifier, slip44: coinType, chainId } = network

    const registry = new Registry(defaultStargateTypes);

    function getAccount (address) {
        return axios
            .get(restUrl + "/cosmos/auth/v1beta1/accounts/" + address)
            .then((res) => res.data.account)
            .then((value) => {
                const baseAccount =
                    value.BaseAccount || value.baseAccount || value.base_account;
                if (baseAccount) {
                    value = baseAccount;
                }
                const baseVestingAccount =
                    value.BaseVestingAccount ||
                    value.baseVestingAccount ||
                    value.base_vesting_account;
                if (baseVestingAccount) {
                    value = baseVestingAccount;

                    const baseAccount =
                        value.BaseAccount || value.baseAccount || value.base_account;
                    if (baseAccount) {
                        value = baseAccount;
                    }
                }

                const nestedAccount = value.account
                if (nestedAccount) {
                    value = nestedAccount
                }

                return value
            })
            .catch((error) => {
                if (error.response?.status === 404) {
                    throw new Error('Account does not exist on chain')
                } else {
                    throw error
                }
            })
    };
    function coin (amount, denom) {
        return _coin(format(floor(amount), { notation: 'fixed' }), denom)
    }

    function calculateFee (gasLimit, gasPrice) {
        const processedGasPrice = typeof gasPrice === "string" ? GasPrice.fromString(gasPrice) : gasPrice;
        const { denom, amount: gasPriceAmount } = processedGasPrice;
        const amount = ceil(bignumber(multiply(bignumber(gasPriceAmount.toString()), bignumber(gasLimit.toString()))));
        return {
            amount: [coin(amount, denom)],
            gas: gasLimit.toString()
        };
    }

    function getFee (gas, gasPrice) {
        if (!gas)
            gas = 200000;
        return calculateFee(gas, gasPrice || defaultGasPrice);
    }



    async function signAndBroadcast (address, messages, gas, memo) {
        if (!gas)
            gas = await simulate(address, messages, memo);
        const fee = getFee(gas, defaultGasPrice);
        const txBody = await sign(address, messages, memo, fee)
        return broadcast(txBody)
    }

    async function broadcast (txBody) {
        const response = await axios.post(restUrl + '/cosmos/tx/v1beta1/txs', {
            tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
            mode: "BROADCAST_MODE_SYNC"
        })
        const result = parseTxResult(response.data.tx_response)
        assertIsDeliverTxSuccess(result);
        return result;
    }

    async function sign (address, messages, memo, fee) {
        const account = await getAccount(address)
        const { account_number: accountNumber } = account
        const txBodyBytes = makeBodyBytes(messages, memo)
        const authInfoBytes = await makeAuthInfoBytes(account, {
            amount: fee.amount,
            gasLimit: fee.gas,
        }, SignMode.SIGN_MODE_DIRECT)
        const signDoc = makeSignDoc(txBodyBytes, authInfoBytes, chainId, accountNumber);
        const { signature, signed } = await signer.signDirect(address, signDoc);
        return {
            bodyBytes: signed.bodyBytes,
            authInfoBytes: signed.authInfoBytes,
            signatures: [fromBase64(signature.signature)],
        }
    }


    async function simulate (address, messages, memo, modifier) {
        const account = await getAccount(address)
        const fee = getFee(100_000)
        const txBody = {
            bodyBytes: makeBodyBytes(messages, memo),
            authInfoBytes: await makeAuthInfoBytes(account, {
                amount: fee.amount,
                gasLimit: fee.gas,
            }, SignMode.SIGN_MODE_UNSPECIFIED),
            signatures: [new Uint8Array()],
        }

        try {
            const estimate = await axios.post(restUrl + '/cosmos/tx/v1beta1/simulate', {
                tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
            }).then(el => el.data.gas_info.gas_used)
            return (parseInt(estimate * (modifier || defaultGasModifier)));
        } catch (error) {
            throw new Error(error.response?.data?.message || error.message)
        }
    }

    function parseTxResult (result) {
        return {
            code: result.code,
            height: result.height,
            rawLog: result.raw_log,
            transactionHash: result.txhash,
            gasUsed: result.gas_used,
            gasWanted: result.gas_wanted,
        }
    }

    function makeBodyBytes (messages, memo) {
        const anyMsgs = messages.map((m) => registry.encodeAsAny(m));
        return TxBody.encode(
            TxBody.fromPartial({
                messages: anyMsgs,
                memo: memo,
            })
        ).finish()
    }

    async function makeAuthInfoBytes (account, fee, mode) {
        const { sequence } = account
        const accountFromSigner = (await signer.getAccounts())[0]
        if (!accountFromSigner) {
            throw new Error("Failed to retrieve account from signer");
        }
        const signerPubkey = accountFromSigner.pubkey;
        return AuthInfo.encode({
            signerInfos: [
                {
                    publicKey: {
                        typeUrl: pubkeyTypeUrl(account.pub_key),
                        value: PubKey.encode({
                            key: signerPubkey,
                        }).finish(),
                    },
                    sequence: Long.fromNumber(sequence, true),
                    modeInfo: { single: { mode: mode } },
                },
            ],
            fee: Fee.fromPartial(fee),
        }).finish()
    }

    function pubkeyTypeUrl (pub_key) {
        if (pub_key && pub_key['@type']) return pub_key['@type']

        if (network.path === 'injective') {
            return '/injective.crypto.v1beta1.ethsecp256k1.PubKey'
        }

        if (coinType === 60) {
            return '/ethermint.crypto.v1.ethsecp256k1.PubKey'
        }
        return '/cosmos.crypto.secp256k1.PubKey'
    }

    return {
        signer,
        registry,
        getFee,
        simulate,
        signAndBroadcast
    };
}

export default EthermintSigningClient;