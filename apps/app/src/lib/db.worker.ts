import { ChatDB } from "@nosana-chat/indexdb";
import * as Comlink from "comlink";

const db = ChatDB.getInstance();

Comlink.expose(db);
