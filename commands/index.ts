import { ping } from "./ping";
import { kick } from "./kick";
import { stats } from "./stats";
import { giveBeta } from "./giveBeta";
import { set_logs } from "./set_logs";
import { ticket } from "./ticket";
import { modrating } from "./modRating";
import { rep } from "./rep";
import { daily } from "./daily";
import { ban } from "./ban";
import { unban } from "./unBan";
import { warn } from "./warn";
import { unwarn } from "./unwarn";
import { paywarn } from "./removewarn";
import { warns } from "../commands/warns";
import { appeal } from "./appeal";
import { createrole } from "../commands/createrole";
import { inventory } from "../commands/inventory";
import { sellrole } from "../commands/sellrole";
import { shop } from "../commands/shop";
import { buyrole } from "../commands/buyrole";
import { InventoryService } from "../services/inventory.service";
import { givecoin } from "./givecoin";
import { transfer } from "./transfer";
import { infoembeds } from "./infoembeds";
import { mute } from "./mute";
import { unmute } from "./unmute";

export const commands = {
    ping,
    kick,
    stats,
    beta: giveBeta,
    set_logs,
    ticket,
    modrating,
    rep,
    daily,
    ban,
    unban,
    warn,
    unwarn,
    paywarn,
    warns,
    appeal,
    createrole,
    sellrole,
    shop,
    buyrole,
    inventory,
    givecoin,
    transfer,
    infoembeds,
    mute,
    unmute,
};