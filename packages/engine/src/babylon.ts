/**
 * The only module that imports Babylon.js (ADR-0001). Deep imports keep the bundle tree-shakeable;
 * the side-effect imports at the bottom register the scene components the engine uses.
 */
export { Engine } from "@babylonjs/core/Engines/engine";
export { NullEngine } from "@babylonjs/core/Engines/nullEngine";
export { Scene } from "@babylonjs/core/scene";
export { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
export { Matrix, Vector2, Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
export { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
export { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
export { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
export { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
export { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
export { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
export { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
export { Texture } from "@babylonjs/core/Materials/Textures/texture";
export { Mesh } from "@babylonjs/core/Meshes/mesh";
export { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
export { TransformNode } from "@babylonjs/core/Meshes/transformNode";
export { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
export type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
export { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
export { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
export type { Particle } from "@babylonjs/core/Particles/particle";
export { Color4 as ParticleColor } from "@babylonjs/core/Maths/math.color";
export { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
export { Effect } from "@babylonjs/core/Materials/effect";
export { ColorCurves } from "@babylonjs/core/Materials/colorCurves";
export { VolumetricLightScatteringPostProcess } from "@babylonjs/core/PostProcesses/volumetricLightScatteringPostProcess";

import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Meshes/Builders/linesBuilder";
import "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Particles/particleSystemComponent";
import "@babylonjs/core/Meshes/thinInstanceMesh";
