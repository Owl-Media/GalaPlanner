import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';
import { installFakeIndexedDb, resetFakeIndexedDb } from './fakeIndexedDb';

installFakeIndexedDb();

beforeEach(() => {
  resetFakeIndexedDb();
  localStorage.clear();
});
