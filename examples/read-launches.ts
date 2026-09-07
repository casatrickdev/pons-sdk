import { PonsClient } from "../src/index.js";

const pons = new PonsClient();

const launches = await pons.getLaunches({
  fromBlock: 8_991_118n,
  toBlock: "latest",
});

for (const launch of launches.slice(0, 10)) {
  console.log(launch);
}
