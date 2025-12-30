import { expect } from 'chai';
import { JsonStore } from '../src/storage/jsonStore';
import fs from 'fs';
import path from 'path';

const testDataPath = path.join(__dirname, '../data/jobs.json');

describe('JsonStore', () => {
    let store;

    beforeEach(() => {
        store = new JsonStore(testDataPath);
        fs.writeFileSync(testDataPath, JSON.stringify([])); // Reset the file before each test
    });

    afterEach(() => {
        fs.unlinkSync(testDataPath); // Clean up after each test
    });

    it('should save a job to the store', async () => {
        const job = { id: 1, name: 'Test Job' };
        await store.save(job);
        const jobs = JSON.parse(fs.readFileSync(testDataPath));
        expect(jobs).to.deep.include(job);
    });

    it('should retrieve a job from the store', async () => {
        const job = { id: 1, name: 'Test Job' };
        await store.save(job);
        const retrievedJob = await store.get(1);
        expect(retrievedJob).to.deep.equal(job);
    });

    it('should return null for a non-existent job', async () => {
        const retrievedJob = await store.get(999);
        expect(retrievedJob).to.be.null;
    });

    it('should update a job in the store', async () => {
        const job = { id: 1, name: 'Test Job' };
        await store.save(job);
        job.name = 'Updated Job';
        await store.update(job);
        const updatedJob = await store.get(1);
        expect(updatedJob).to.deep.equal(job);
    });

    it('should delete a job from the store', async () => {
        const job = { id: 1, name: 'Test Job' };
        await store.save(job);
        await store.delete(1);
        const retrievedJob = await store.get(1);
        expect(retrievedJob).to.be.null;
    });
});