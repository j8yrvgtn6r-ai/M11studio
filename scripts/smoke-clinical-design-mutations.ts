import {
  designEntityExists,
  entityHasRelationshipReferences,
  findDesignEntity,
  findDesignEntityInDocument,
  findRelationship,
  relationshipExists,
} from '../src/app/domain/protocol/clinicalDesign';
import {
  createDesignEntity,
  createRelationship,
  deleteDesignEntity,
  deleteRelationship,
  getProtocolDocument,
  getProtocolSnapshot,
  resetProtocolStore,
  updateDesignEntity,
  updateRelationship,
} from '../src/app/domain/protocol/store';
import { validateProtocol } from '../src/app/domain/protocol/validateProtocol';

function fail(message: string): never {
  console.error(`Smoke test failed: ${message}`);
  process.exitCode = 1;
  process.exit(1);
}

resetProtocolStore();

const seedValidation = validateProtocol(getProtocolDocument());
if (!seedValidation.valid) {
  fail('seed document failed validateProtocol() before mutations');
  console.error(seedValidation.errors);
}

const entityId = 'obj-1';
const before = findDesignEntity(entityId);

if (!before) {
  fail(`entity "${entityId}" not found`);
}

const originalDescription = before.entity.description;

const patchedDescription = `${originalDescription ?? ''} [smoke-test]`.trim();
if (!updateDesignEntity(entityId, { description: patchedDescription })) {
  fail(`updateDesignEntity("${entityId}") description patch returned false`);
}

const afterDescription = findDesignEntity(entityId);
if (afterDescription?.entity.description !== patchedDescription) {
  fail('store entity description was not updated');
}

const snapshotLocation = findDesignEntityInDocument(getProtocolSnapshot(), entityId);
if (snapshotLocation?.entity.description !== patchedDescription) {
  fail('getProtocolSnapshot() did not reflect the description mutation');
}

const validSectionRef = '4';
if (!updateDesignEntity(entityId, { sectionRef: validSectionRef })) {
  fail(`valid sectionRef update to "${validSectionRef}" returned false`);
}

const sectionRefBeforeInvalidAttempt = findDesignEntity(entityId)?.entity.sectionRef;
if (updateDesignEntity(entityId, { sectionRef: 'nonexistent-section-id' })) {
  fail('invalid sectionRef update should have returned false');
}

if (findDesignEntity(entityId)?.entity.sectionRef !== sectionRefBeforeInvalidAttempt) {
  fail('invalid sectionRef update mutated the store');
}

const smokeRelationshipId = 'smoke-rel-test';

if (
  !createRelationship({
    id: smokeRelationshipId,
    sourceId: 'obj-1',
    targetId: 'stat-1',
    label: 'smoke link',
    kind: 'analyzed-by',
  })
) {
  fail('createRelationship with valid endpoints should succeed');
}

if (!relationshipExists(smokeRelationshipId)) {
  fail('created relationship was not found in store');
}

if (
  createRelationship({
    id: smokeRelationshipId,
    sourceId: 'obj-1',
    targetId: 'stat-1',
  })
) {
  fail('createRelationship with duplicate id should fail');
}

if (
  createRelationship({
    id: 'smoke-rel-invalid-endpoints',
    sourceId: 'missing-entity',
    targetId: 'stat-1',
  })
) {
  fail('createRelationship with invalid sourceId should fail');
}

if (
  !updateRelationship(smokeRelationshipId, {
    label: 'smoke link updated',
    kind: 'defines',
  })
) {
  fail('updateRelationship label/kind patch should succeed');
}

const updatedRelationship = findRelationship(smokeRelationshipId);
if (updatedRelationship?.relationship.label !== 'smoke link updated') {
  fail('updateRelationship did not persist label');
}

if (updateRelationship(smokeRelationshipId, { sourceId: 'missing-entity' })) {
  fail('updateRelationship with invalid sourceId should fail');
}

if (findRelationship(smokeRelationshipId)?.relationship.sourceId !== 'obj-1') {
  fail('invalid updateRelationship mutated sourceId');
}

if (!deleteRelationship(smokeRelationshipId)) {
  fail('deleteRelationship should succeed for created relationship');
}

if (relationshipExists(smokeRelationshipId)) {
  fail('deleted relationship should no longer exist');
}

if (deleteRelationship('missing-relationship-id')) {
  fail('deleteRelationship for missing id should return false');
}

if (!designEntityExists('obj-1')) {
  fail('designEntityExists should return true for seed entity');
}

if (designEntityExists('missing-entity')) {
  fail('designEntityExists should return false for missing entity');
}

const smokeObjectiveId = 'smoke-obj-create';

if (
  !createDesignEntity({
    id: smokeObjectiveId,
    type: 'objective',
    name: 'Smoke Test Objective',
    description: 'Created by clinical design smoke test',
    sectionRef: '3',
    status: ['incomplete'],
    metadata: { source: 'smoke-test' },
  })
) {
  fail('createDesignEntity with valid objective input should succeed');
}

const createdObjective = findDesignEntity(smokeObjectiveId);
if (!createdObjective || createdObjective.collectionKey !== 'objectives') {
  fail('created objective was not found in objectives collection');
}

if (
  createDesignEntity({
    id: smokeObjectiveId,
    type: 'objective',
    name: 'Duplicate Objective',
    status: ['incomplete'],
  })
) {
  fail('createDesignEntity with duplicate id should fail');
}

if (
  createDesignEntity({
    id: 'smoke-obj-invalid-section',
    type: 'objective',
    name: 'Invalid Section Objective',
    sectionRef: 'nonexistent-section-id',
    status: ['incomplete'],
  })
) {
  fail('createDesignEntity with invalid sectionRef should fail');
}

if (!deleteDesignEntity(smokeObjectiveId)) {
  fail('deleteDesignEntity should succeed for unused created entity');
}

if (designEntityExists(smokeObjectiveId)) {
  fail('deleted entity should no longer exist');
}

if (!entityHasRelationshipReferences('obj-1')) {
  fail('seed entity obj-1 should be referenced by relationships');
}

if (deleteDesignEntity('obj-1')) {
  fail('deleteDesignEntity should fail when relationships reference the entity');
}

if (!findDesignEntity('obj-1')) {
  fail('deleteDesignEntity rejection should not remove referenced entity');
}

if (deleteDesignEntity('missing-entity-id')) {
  fail('deleteDesignEntity for missing entity should return false');
}

const cloneDocument = () => structuredClone(getProtocolDocument());

const invalidEndpointDoc = cloneDocument();
invalidEndpointDoc.relationships.push({
  id: 'validation-smoke-invalid-endpoint',
  sourceId: 'missing-entity',
  targetId: 'stat-1',
});
const invalidEndpointResult = validateProtocol(invalidEndpointDoc);
if (invalidEndpointResult.valid) {
  fail('validateProtocol should reject relationship with missing sourceId');
}
if (!invalidEndpointResult.errors.some((error) => error.code === 'invalid_relationship_source')) {
  fail('validateProtocol should report invalid_relationship_source');
}

const duplicateIdDoc = cloneDocument();
duplicateIdDoc.relationships.push({
  id: 'e1',
  sourceId: 'obj-1',
  targetId: 'stat-1',
});
const duplicateIdResult = validateProtocol(duplicateIdDoc);
if (duplicateIdResult.valid) {
  fail('validateProtocol should reject duplicate relationship id');
}
if (!duplicateIdResult.errors.some((error) => error.code === 'duplicate_relationship_id')) {
  fail('validateProtocol should report duplicate_relationship_id');
}

const selfLoopDoc = cloneDocument();
selfLoopDoc.relationships.push({
  id: 'validation-smoke-self-loop',
  sourceId: 'obj-1',
  targetId: 'obj-1',
});
const selfLoopResult = validateProtocol(selfLoopDoc);
if (!selfLoopResult.valid) {
  fail('validateProtocol should remain valid for self-loop relationship');
}
if (!selfLoopResult.warnings.some((warning) => warning.code === 'relationship_self_loop')) {
  fail('validateProtocol should warn on relationship self-loop');
}

const duplicateTupleDoc = cloneDocument();
const seedTuple = duplicateTupleDoc.relationships[0];
duplicateTupleDoc.relationships.push({
  id: 'validation-smoke-duplicate-tuple',
  sourceId: seedTuple.sourceId,
  targetId: seedTuple.targetId,
  kind: seedTuple.kind,
});
const duplicateTupleResult = validateProtocol(duplicateTupleDoc);
if (!duplicateTupleResult.valid) {
  fail('validateProtocol should remain valid for duplicate relationship tuple');
}
if (!duplicateTupleResult.warnings.some((warning) => warning.code === 'duplicate_relationship_tuple')) {
  fail('validateProtocol should warn on duplicate relationship tuple');
}

const validation = validateProtocol(getProtocolDocument());
if (!validation.valid) {
  fail('validateProtocol() returned errors after mutations');
  console.error(validation.errors);
}

resetProtocolStore();

console.log('Clinical design mutation smoke test passed.');
console.log(`  entity: ${entityId}`);
console.log(`  collection: ${before.collectionKey}`);
console.log(`  description and sectionRef guards verified`);
console.log(`  relationship create/update/delete verified`);
console.log(`  design entity create/delete verified`);
console.log(`  duplicate and invalid endpoint guards verified`);
console.log(`  relationship integrity validation verified`);
console.log(`  validateProtocol() passed after mutations`);
console.log(`  store reset to seed`);
