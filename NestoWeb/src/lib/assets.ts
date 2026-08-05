export const ASSET_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"], ACTIVE: ["ASSIGNED", "RESERVED", "MAINTENANCE", "OUT_OF_SERVICE", "RETIRED"],
  ASSIGNED: ["ACTIVE", "RESERVED", "MAINTENANCE", "OUT_OF_SERVICE", "RETIRED"], RESERVED: ["ACTIVE", "ASSIGNED", "MAINTENANCE"],
  MAINTENANCE: ["ACTIVE", "ASSIGNED", "OUT_OF_SERVICE", "RETIRED"], OUT_OF_SERVICE: ["ACTIVE", "MAINTENANCE", "RETIRED"],
  RETIRED: ["DISPOSED", "ARCHIVED"], DISPOSED: ["ARCHIVED"], ARCHIVED: [],
};
export const WORK_ORDER_TRANSITIONS: Record<string,string[]> = { DRAFT:["APPROVED","ARCHIVED"], APPROVED:["ASSIGNED"], ASSIGNED:["IN_PROGRESS"], IN_PROGRESS:["WAITING_PARTS","WAITING_APPROVAL","COMPLETED"], WAITING_PARTS:["IN_PROGRESS"], WAITING_APPROVAL:["IN_PROGRESS","COMPLETED"], COMPLETED:["CLOSED"], CLOSED:["ARCHIVED"], ARCHIVED:[] };
export const canTransitionAsset=(from:string,to:string)=>(ASSET_TRANSITIONS[from]??[]).includes(to);
export const canTransitionWorkOrder=(from:string,to:string)=>(WORK_ORDER_TRANSITIONS[from]??[]).includes(to);
export function straightLineBookValue(cost:number,salvage:number,usefulLifeMonths:number,purchaseDate:Date,asOf=new Date()){if(cost<=0||usefulLifeMonths<=0)return Math.max(0,cost);const elapsed=Math.max(0,(asOf.getUTCFullYear()-purchaseDate.getUTCFullYear())*12+asOf.getUTCMonth()-purchaseDate.getUTCMonth());return Math.max(salvage,cost-(cost-salvage)*Math.min(1,elapsed/usefulLifeMonths));}
