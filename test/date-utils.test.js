import assert from "node:assert/strict";
import test from "node:test";

import {
    criarDataLocal,
    dataDeAmanha,
    dataDeHoje,
    formatarDataBrasileira,
    formatarDataISO
} from "../modules/date-utils.js";

test("formats local dates without UTC day shifts", () => {

    const data =
        new Date(2026, 9, 15, 23, 30);

    assert.equal(
        formatarDataISO(data),
        "2026-10-15"
    );
    assert.equal(
        formatarDataBrasileira("2026-10-15"),
        "15/10/2026"
    );
});

test("rejects invalid calendar dates and handles year boundaries", () => {

    assert.equal(
        criarDataLocal("2026-02-30"),
        null
    );
    assert.equal(
        formatarDataBrasileira("0001-01-01"),
        "01/01/0001"
    );
    assert.equal(
        formatarDataBrasileira("not-a-date"),
        ""
    );
    assert.equal(
        dataDeHoje(new Date(2026, 11, 31, 23, 59)),
        "2026-12-31"
    );
    assert.equal(
        dataDeAmanha(new Date(2026, 11, 31, 23, 59)),
        "2027-01-01"
    );
});
