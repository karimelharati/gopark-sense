'use client';
import { createContext, useContext } from 'react';
export const ParkingContext=createContext(null);
export const useParking=()=>useContext(ParkingContext);
export const money=n=>`$${Number(n).toFixed(2)}`;
export const clock=n=>new Date(n).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Beirut'});
export const day=n=>new Date(n).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'Asia/Beirut'});
