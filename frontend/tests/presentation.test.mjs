import assert from 'node:assert/strict';
import { cameraPresentation, cropForView, displayShapes, shapeAspect, legacyAspect, circleThumbnailCrop, placementFromCrop, validPresentation } from '../src/lib/presentation.ts';

for (const { value: shape } of displayShapes) {
  const crop = cropForView(1200, 800, shape, 1.7, 0.68, 0.33);
  assert.equal(crop.display_shape, shape);
  assert.equal(validPresentation(crop), true);
  assert.ok(Math.abs(1200 * crop.crop_width / (800 * crop.crop_height) - shapeAspect(shape)) < 1e-10);
  const saved = JSON.parse(JSON.stringify(crop));
  assert.deepEqual(saved, crop, `${shape} survives serialization and reload`);
  assert.deepEqual(cropForView(1200, 800, shape, 1.7, 0.68, 0.33), crop,
    `${shape} is independent of wall position and viewport`);
  const thumbnail = circleThumbnailCrop(crop, 1200, 800);
  assert.equal(validPresentation(thumbnail), true);
  assert.ok(thumbnail.crop_x >= crop.crop_x && thumbnail.crop_y >= crop.crop_y);
  assert.ok(thumbnail.crop_x + thumbnail.crop_width <= crop.crop_x + crop.crop_width + 1e-10);

  const cameraCrop = cameraPresentation(1920, 1080, shape);
  assert.equal(cameraCrop.display_shape, shape);
  assert.ok(Math.abs(1920 * cameraCrop.crop_width / (1080 * cameraCrop.crop_height) - shapeAspect(shape)) < 1e-10);
  assert.ok(Math.abs(cameraCrop.crop_x - (1 - cameraCrop.crop_width) / 2) < 1e-10);
  assert.ok(Math.abs(cameraCrop.crop_y - (1 - cameraCrop.crop_height) / 2) < 1e-10);
  assert.deepEqual(cameraPresentation(1920, 1080, shape), cameraCrop, 'the same frame produces the same saved crop');
  const placement = placementFromCrop(cameraCrop);
  assert.ok(Math.abs(placement.left + cameraCrop.crop_x * placement.width) < 1e-10);
  assert.ok(Math.abs(placement.left + (cameraCrop.crop_x + cameraCrop.crop_width) * placement.width - 1) < 1e-10);
  assert.ok(Math.abs(placement.top + cameraCrop.crop_y * placement.height) < 1e-10);
  assert.ok(Math.abs(placement.top + (cameraCrop.crop_y + cameraCrop.crop_height) * placement.height - 1) < 1e-10);
  const portraitSource = cameraPresentation(1080, 1920, shape);
  assert.ok(Math.abs(1080 * portraitSource.crop_width / (1920 * portraitSource.crop_height) - shapeAspect(shape)) < 1e-10);
  assert.ok(Math.abs(portraitSource.crop_x - (1 - portraitSource.crop_width) / 2) < 1e-10);
  assert.ok(Math.abs(portraitSource.crop_y - (1 - portraitSource.crop_height) / 2) < 1e-10);
}
assert.equal(legacyAspect(1200, 800), 1.5);
assert.equal(legacyAspect(null, null), 1);
assert.equal(validPresentation({ display_shape: 'square', crop_x: 0.8, crop_y: 0,
  crop_width: 0.5, crop_height: 1 }), false);
console.log('Presentation: five saved shapes, camera cover crop, gallery crop, circle thumbnails, reload, and legacy fallback passed');
