import { ownerFor } from '../../../lib/repository';
import { runSimulation } from '../../../lib/simulation.mjs';
export async function POST(request:Request){try{ownerFor(request);return Response.json(runSimulation(await request.json()));}catch(e){return Response.json({error:(e as Error).message},{status:400});}}
