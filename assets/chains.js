export const chainMap = {
    "cosmoshub-4":{
        name:'cosmos',
        rpc:'https://cosmoshub.validator.network/',
        symbol:'ATOM',
        denom: "uatom",
        exponent: 6,
        min_tx_fee: "800",
        gas:120000,
        prefix:"cosmos",
        claim_min:0.1
    },
    "osmosis-1":{
        name:'osmosis',
        rpc:'https://osmosis.validator.network/',
        symbol:'OSMO',
        denom: "uosmo",
        exponent: 6,
        min_tx_fee: "800",
        gas:200000,
        prefix:"osmo",
        claim_min:0.1
    },
    "juno-1":{
        name:'juno',
        rpc:'https://rpc-juno.itastakers.com',
        symbol:'JUNO',
        denom: "ujuno",
        exponent: 6,
        min_tx_fee: "3000",
        gas:120000,
        prefix:"juno",
        claim_min:0.1
    },
    "akashnet-2":{
        name:'akash-network',
        rpc:'https://rpc.akash.forbole.com:443',
        symbol:'AKT',
        denom: "uakt",
        exponent: 6,
        min_tx_fee: "8000",
        gas:120000,
        prefix:"akash",
        claim_min:1

    },
    "stargaze-1":{
        name:'stargaze',
        rpc:'https://rpc.stargaze-apis.com/',
        symbol:'STARS',
        denom: "ustars",
        exponent: 6,
        min_tx_fee: "800",
        gas:800000,
        prefix:"stars",
        claim_min:1

    },
    "chihuahua-1":{
        name:'chihuahua',
        rpc:'https://chihuahua-rpc.mercury-nodes.net/',
        symbol:'HUAHUA',
        denom: "uhuahua",
        exponent: 6,
        min_tx_fee: "8000",
        gas:160000,
        prefix:"chihuahua",
        claim_min:100
    }
}