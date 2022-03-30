import { Bech32} from "@cosmjs/encoding";

const prefixes =["osmo","juno","akash","stars","chihuahua","regen","cerberus","somm","umee"]
function convert(address,prefix){
    let decode = Bech32.decode(address,0);
    return Bech32.encode(prefix,decode.data);
}


const cosmosAddress = ""
for(let prefix of prefixes){
    console.log(convert(cosmosAddress,prefix));
}