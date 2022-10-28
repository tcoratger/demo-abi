import algosdk, { decodeAddress, Transaction } from "algosdk";
import * as fs from "fs";
import { Buffer } from "buffer";
import { getAccounts } from "./sandbox";

const algod_token =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const algod_host = "http://127.0.0.1";
const algod_port = "4001";

(async function () {
  // Create a client to communicate with local node
  const client = new algosdk.Algodv2(algod_token, algod_host, algod_port);

  // Get account from sandbox
  const accounts = await getAccounts();
  const acct = accounts[0];
  const acct1 = accounts[1];
  const acct2 = accounts[2];

  // Read in the local contract.json file
  const buff = fs.readFileSync("../contract.json");

  // Parse the json file into an object, pass it to create an ABIContract object
  const contract = new algosdk.ABIContract(JSON.parse(buff.toString()));

  const appId = parseInt(fs.readFileSync("../.app_id").toString());

  // We initialize the common parameters here, they'll be passed to all the transactions
  // since they happen to be the same
  const spNoFee = await client.getTransactionParams().do();
  spNoFee.flatFee = true;
  spNoFee.fee = 0;

  const spFullFee = await client.getTransactionParams().do();
  spFullFee.flatFee = true;
  spFullFee.fee = 3 * algosdk.ALGORAND_MIN_TX_FEE;

  function SetcommonParams(sp: any, account: any) {
    return {
      appID: appId,
      sender: account.addr,
      suggestedParams: sp,
      signer: algosdk.makeBasicAccountTransactionSigner(account),
    };
  }
  
  const comp = new algosdk.AtomicTransactionComposer();

  // Transaction from the user to the dApp (amount = 0 and fees = 0)
  const txn = algosdk.makePaymentTxnWithSuggestedParams(
    acct.addr, 
    acct2.addr, 
    0, 
    undefined, 
    undefined, 
    spNoFee);

  const transactionWithSigner = {
    txn: txn,
    signer: algosdk.makeBasicAccountTransactionSigner(acct)
  };

  comp.addTransaction(transactionWithSigner)

  // Transaction being passed as an argument, this removes the transaction from the
  // args list, but includes it in the atomic grouped transaction
  // Transaction from Grindery wallet to the dApp (amount = 0, fees = 3 * fees)
  comp.addMethodCall({
    method: contract.getMethodByName("txntest"),
    methodArgs: [
      0,
      {
        txn: new Transaction({
          from: acct1.addr,
          to: acct2.addr,
          amount: 0,
          ...spNoFee,
        }),
        signer: algosdk.makeBasicAccountTransactionSigner(acct1),
      },
      0,
    ],
    ...SetcommonParams(spFullFee, acct1),
  });

  // Finally, execute the composed group and print out the results
  const results = await comp.execute(client, 2);
  console.log(results);
})();
