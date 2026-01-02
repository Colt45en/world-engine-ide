/**
 * IPhysicsWorld and data structures (JS/JSDoc flavor)
 * These provide the contract between the World Engine and the Physics Core.
 * Implementation should follow these shapes.
 */

/**
 * @typedef {string|number} EntityId
 */

/**
 * @typedef {{x:number,y:number,z:number}} Vec3
 */

/**
 * @typedef {{x:number,y:number,z:number,w:number}} Quat
 */

/**
 * @typedef {number[] | Float32Array} Mat4
 * A 4x4 matrix. If provided as an array, translation is assumed at indices 12..14.
 */

/**
 * Compute backend selector. Backends are immutable after Initialize() until Shutdown().
 * @typedef {'CPU'|'WEBGPU'|'CUDA'|'VULKAN'} ComputeBackend
 */

/**
 * Shape type selector.
 * @typedef {'SPHERE'|'BOX'|'CONVEX_HULL'} ShapeType
 */

/**
 * Constraint type selector.
 * @typedef {'BALL_SOCKET'|'HINGE'|'DISTANCE'|'FIXED'} ConstraintType
 */

/**
 * @typedef {Object} MaterialProps
 * @property {number} friction
 * @property {number} restitution
 */

/**
 * @typedef {Object} Shape
 * @property {ShapeType} type
 * @property {number} [radius]
 * @property {Vec3} [halfExtents]
 */

/**
 * Global configuration for the simulation.
 * `compute_backend` is immutable after Initialize() until Shutdown().
 *
 * @typedef {Object} SimulationSettings
 * @property {number} [fixed_timestep]
 * @property {number} [solver_iterations]
 * @property {Vec3} [gravity]
 * @property {ComputeBackend} [compute_backend]
 */

/**
 * Backward-compatible alias.
 * @typedef {SimulationSettings} PhysicsSettings
 */

/**
 * @typedef {Object} BodyCreationData
 * @property {Mat4|Vec3} initial_transform
 * @property {number} mass
 * @property {boolean} is_kinematic
 * @property {MaterialProps} material_props
 * @property {Shape} shape
 * @property {number} [collision_layer]
 * @property {number} [collision_mask]
 */

/**
 * @typedef {Object} BodyUpdateData
 * @property {number} [mass]
 * @property {number} [friction]
 * @property {number} [restitution]
 * @property {Shape} [shape]
 * @property {Vec3} [linear_velocity]
 * @property {Vec3} [angular_velocity]
 */

/**
 * @typedef {Object} ConstraintCreationData
 * @property {ConstraintType} type
 * @property {EntityId} body_a_id
 * @property {EntityId} body_b_id
 * @property {Vec3} local_anchor_a
 * @property {Vec3} local_anchor_b
 * @property {{min_angle?:number,max_angle?:number}} [limits]
 * @property {number} [rest_distance] // for DISTANCE
 * @property {number} [stiffness] // for DISTANCE (0..1)
 */

/**
 * @typedef {Object} TransformUpdate
 * @property {EntityId} entity_id
 * @property {Vec3} position
 * @property {Quat} rotation // quaternion
 */

/**
 * @typedef {Object} VelocityUpdate
 * @property {EntityId} entity_id
 * @property {Vec3} linear
 * @property {Vec3} angular
 */

/**
 * @typedef {Object} CollisionEvent
 * @property {EntityId} entity_a_id
 * @property {EntityId} entity_b_id
 * @property {Vec3} contact_point
 * @property {Vec3} [normal]
 * @property {number} impulse_magnitude
 */

/**
 * Solver warm-start cache for constraints/contacts.
 * This is intentionally opaque at the interface level; implementations may store per-contact IDs, rows, etc.
 * @typedef {any} WarmStartCache
 */

/**
 * Physics state snapshot payload.
 * Implementations must capture enough to deterministically resume at a given frame index.
 * @typedef {Object} PhysicsSnapshot
 * @property {number} frame
 * @property {any} state
 */

/**
 * Step output batch (matches Y_k in the fixed-step spec).
 * @typedef {Object} PhysicsStepOutput
 * @property {TransformUpdate[]} transforms
 * @property {VelocityUpdate[]} velocities
 * @property {CollisionEvent[]} events
 */

/**
 * Result of RayCast.
 * @typedef {Object} RayCastHit
 * @property {EntityId} entity
 * @property {Vec3} contact_point
 * @property {Vec3} normal
 */

/**
 * IPhysicsWorld: primary interface the World Engine calls.
 *
 * Notes:
 * - `entity_id` is opaque to physics; do not assume ordering or lifetime.
 * - Step() must be deterministic and pure w.r.t. input state + delta_time.
 *
 * @interface IPhysicsWorld
 */

/**
 * @function
 * @name IPhysicsWorld#Initialize
 * @param {PhysicsSettings} settings
 * @returns {boolean}
 */

/**
 * @function
 * @name IPhysicsWorld#Shutdown
 * @returns {void}
 */

/**
 * @function
 * @name IPhysicsWorld#AddBody
 * @param {EntityId} entity_id
 * @param {BodyCreationData} data
 * @returns {any}
 */

/**
 * @function
 * @name IPhysicsWorld#RemoveBody
 * @param {EntityId} entity_id
 * @returns {void}
 */

/**
 * @function
 * @name IPhysicsWorld#UpdateBody
 * @param {EntityId} entity_id
 * @param {BodyUpdateData} data
 * @returns {any|null}
 */

/**
 * @function
 * @name IPhysicsWorld#AddConstraint
 * @param {EntityId} entity_id
 * @param {ConstraintCreationData|any} data
 * @returns {any}
 */

/**
 * @function
 * @name IPhysicsWorld#Step
 * @param {number} delta_time
 * @returns {void}
 */

/**
 * @function
 * @name IPhysicsWorld#SaveSnapshot
 * @param {number} frame_number
 * @returns {void}
 */

/**
 * @function
 * @name IPhysicsWorld#RestoreSnapshot
 * @param {number} frame_number
 * @returns {boolean}
 */

/**
 * @function
 * @name IPhysicsWorld#RayCast
 * @param {Vec3} start
 * @param {Vec3} end
 * @returns {RayCastHit|null}
 */

/**
 * @function
 * @name IPhysicsWorld#CollectEvents
 * @returns {CollisionEvent[]}
 */

/**
 * @function
 * @name IPhysicsWorld#GetDebugData
 * @returns {any}
 */

// Export for consumer reference
export const ComputeBackends = /** @type {const} */ ({
  CPU: 'CPU',
  WEBGPU: 'WEBGPU',
  CUDA: 'CUDA',
  VULKAN: 'VULKAN',
});

export const ShapeTypes = /** @type {const} */ ({
  SPHERE: 'SPHERE',
  BOX: 'BOX',
  CONVEX_HULL: 'CONVEX_HULL',
});

export const ConstraintTypes = /** @type {const} */ ({
  BALL_SOCKET: 'BALL_SOCKET',
  HINGE: 'HINGE',
  DISTANCE: 'DISTANCE',
  FIXED: 'FIXED',
});

export default {};
