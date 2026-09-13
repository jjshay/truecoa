const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const files = ["google-apps-script/COAGenerator.gs", "google-apps-script/COAGenerator_Combined.gs"];
for (const file of files) {
  const isGallery = file.startsWith('3dsellers/') || file.startsWith('utilities/');
  const property = isGallery ? 'GALLERY_UPLOAD_API_KEY' : 'BITLY_API_KEY';
  const expression = file.startsWith('3dsellers/') ? 'NAMECHEAP_CONFIG.API_KEY'
    : file.startsWith('utilities/') ? 'getCatalogUploadKey()' : 'CONFIG.BITLY_API_KEY';
  function load(value) {
    const state = { value, reads: 0, requests: [] };
    const context = vm.createContext({
      PropertiesService: { getScriptProperties: () => ({ getProperty: name => {
        assert.equal(name, property);
        state.reads++;
        return state.value;
      } }) },
      Logger: { log() {} },
      SpreadsheetApp: { getActiveSpreadsheet: () => ({}) },
      UrlFetchApp: { fetch: (...args) => {
        state.requests.push(args);
        return { getResponseCode: () => 201, getContentText: () => JSON.stringify({ link: 'https://example.com/short' }) };
      } },
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
    assert.equal(state.reads, 0, 'Loading unrelated script features must not require a key');
    return { state, context };
  }

  test(`${file}: missing and blank credentials fail without HTTP requests`, () => {
    for (const value of [null, '', '   ']) {
      const { state, context } = load(value);
      assert.throws(() => vm.runInContext(expression, context), new RegExp(`Set ${property}`));
      if (!isGallery) {
        assert.equal(vm.runInContext("createBitlyShortLink('https://example.com/verify', 'TEST')", context), null);
      } else if (file.startsWith('utilities/')) {
        assert.throws(() => vm.runInContext('createCatalogWithCPanelStatus()', context), /Set GALLERY_UPLOAD_API_KEY/);
      }
      assert.equal(state.requests.length, 0);
    }
  });

  test(`${file}: reads protected properties and picks up rotation`, () => {
    const { state, context } = load('  fixture-one  ');
    assert.equal(vm.runInContext(expression, context), 'fixture-one');
    state.value = 'fixture-two';
    assert.equal(vm.runInContext(expression, context), 'fixture-two');
    if (!isGallery) {
      assert.equal(vm.runInContext("createBitlyShortLink('https://example.com/verify', 'TEST')", context), 'https://example.com/short');
      assert.equal(state.requests[0][1].headers.Authorization, 'Bearer fixture-two');
    }
  });
}
