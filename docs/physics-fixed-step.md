# Fixed-step physics pipeline + rollback contract

This document mirrors the formal fixed-timestep pipeline used by the World Engine physics core.

## Definitions

Let $h>0$ be the fixed physics timestep, $k\in\mathbb{N}$ the physics frame index, and $t_k = k h$.

### State, inputs, outputs

$$
S_k := (X_k, V_k, \Omega_k, Q_k, \Lambda_k)
$$

$$
U_k := (F_k,\; \tau_k,\; \text{kinematic targets }(X_k^{\star},Q_k^{\star}),\; \Delta\Theta_k)
$$

$$
Y_k := (\widehat{X}_{k+1},\widehat{Q}_{k+1},\widehat{V}_{k+1},\widehat{\Omega}_{k+1},\mathcal{E}_{k+1})
$$

- $X_k$ pose positions, $Q_k$ orientations (quaternions)
- $V_k$ linear velocities, $\Omega_k$ angular velocities
- $\Lambda_k$ warm-start cache for impulses/constraint multipliers
- $\mathcal{E}_{k+1}$ event batch (collision/contact events)

## Rollback snapshot contract

Save snapshot:

$$
\text{SaveSnapshot}(k):\quad \Sigma_k = \mathcal{S}(S_k)
$$

Restore snapshot:

$$
\text{RestoreSnapshot}(k):\quad S_k = \mathcal{S}^{-1}(\Sigma_k)
$$

Contract requirements:

- Snapshot is deterministic and sufficient to resume the pipeline at frame $k$.
- Restore must also restore any solver warm-start state (e.g., $\Lambda_k$) if you want identical replay.

## Fixed-step pipeline (Math → Physics → Output)

### 1) Apply external inputs (forces/targets)

$$
(F_k^{\text{tot}},\tau_k^{\text{tot}}) = \Phi(S_k, U_k)
$$

Per-body kinematic override:

$$
(X_k^{i},Q_k^{i},V_k^{i},\Omega_k^{i}) =
\begin{cases}
(X_k^{\star i},Q_k^{\star i},V_k^{\star i},\Omega_k^{\star i}) & \text{if kinematic}\\
(X_k^{i},Q_k^{i},V_k^{i},\Omega_k^{i}) & \text{otherwise}
\end{cases}
$$

### 2) Integrate predicted (unconstrained) velocities

Let $M$ be the block-diagonal mass matrix and $I$ the inertia tensor in world space.

$$
V_k^- = V_k + h\,M^{-1}F_k^{\text{tot}}
$$

$$
\Omega_k^- = \Omega_k + h\,I^{-1}\tau_k^{\text{tot}}
$$

### 3) Integrate predicted poses

$$
X_{k+1}^- = X_k + h\,V_k^-
$$

Quaternion update with $\omega(\Omega) = (0,\Omega_x,\Omega_y,\Omega_z)$:

$$
Q_{k+1}^- = \operatorname{normalize}\left(Q_k + \frac{h}{2}\,\omega(\Omega_k^-)\otimes Q_k\right)
$$

### 4) Broadphase candidate generation

AABB construction:

$$
A_k = \mathcal{A}(X_{k+1}^-, Q_{k+1}^-, \text{shapes})
$$

Broadphase pairs:

$$
\mathcal{P}_k = \mathcal{B}(A_k)
$$

### 5) Narrowphase contact generation

$$
\mathcal{C}_k = \mathcal{N}(\mathcal{P}_k, X_{k+1}^-, Q_{k+1}^-, \text{shapes})
$$

Each contact row produces a constraint row (normal + friction directions), penetration $\phi$, Jacobian $J$, bias $b$, and bounds $[\lambda_{\min},\lambda_{\max}]$.

### 6) Constraint + contact solve (iterative impulses)

Stack constraints:

$$
J_k,\; \phi_k,\; b_k,\; \lambda_{\min,k},\; \lambda_{\max,k}
$$

Effective mass (Schur complement):

$$
W_k = J_k M^{-1} J_k^{\mathsf T}
$$

Let $\mathbf{v}_k^- = [V_k^-\;\;\Omega_k^-]^\mathsf{T}$.

Solve:

$$
\lambda_k = \arg\min_{\lambda \in [\lambda_{\min,k},\lambda_{\max,k}]}
\left\| W_k\lambda + J_k\mathbf{v}_k^- + b_k \right\|^2
$$

Projected Gauss–Seidel (row $r$, iteration $m$):

$$
\lambda_r^{(m+1)} = \Pi_{[\lambda_{\min,r},\lambda_{\max,r}]}\left(
\lambda_r^{(m)} - \frac{(W\lambda^{(m)} + J\mathbf{v}^- + b)_r}{W_{rr}}
\right)
$$

Warm-start cache:

$$
\Lambda_{k+1} = \lambda_k
$$

### 7) Velocity correction (impulse application)

$$
\mathbf{v}_{k+1} = \mathbf{v}_k^- + M^{-1}J_k^{\mathsf T}\lambda_k
$$

### 8) Pose write-back (post-solve integration)

$$
X_{k+1} = X_k + h\,V_{k+1}
$$

$$
Q_{k+1} = \operatorname{normalize}\left(Q_k + \frac{h}{2}\,\omega(\Omega_{k+1})\otimes Q_k\right)
$$

Final state:

$$
S_{k+1} = (X_{k+1},V_{k+1},\Omega_{k+1},Q_{k+1},\Lambda_{k+1})
$$

## Event emission (collision events)

For each contact manifold $c$ with normal impulse component $\lambda_n(c)$:

$$
\text{impulse\_magnitude}(c) = |\lambda_n(c)|
$$

Emit:

$$
\mathcal{E}_{k+1} = \{(e_a(c),e_b(c),p(c),n(c),|\lambda_n(c)|) : c\in\mathcal{C}_k \land |\lambda_n(c)|>\varepsilon\}
$$

## Graphics interpolation (variable render time)

Render time $t\in[t_k,t_{k+1})$ with:

$$
\alpha(t) = \frac{t-t_k}{h}\in[0,1)
$$

Position interpolation:

$$
X_{\text{render}}(t) = (1-\alpha)X_k + \alpha X_{k+1}
$$

Orientation interpolation:

$$
Q_{\text{render}}(t) = \operatorname{slerp}(Q_k,Q_{k+1},\alpha)
$$

## Repo mapping (current)

- Contract types live in src/physics/interfaces.js.
- Minimal CPU stub lives in src/physics/physicsWorld.js.
- ECS adapter is src/physics/adapter.js.

### Fixed-step accumulator wrapper

For variable-frame updates (e.g., render loop $\Delta t$), use the fixed-step accumulator:

- src/physics/fixedStep.js (`FixedStepAccumulator`)

It consumes variable `dt`, advances the world in exact `h = fixed_timestep` substeps, and retains the last two fixed frames (maps keyed by `entity_id`) so you can interpolate $(X_k, X_{k+1})$ using $\alpha = \tfrac{t - t_k}{h}$.

This repo’s current stub does **not** yet implement full angular dynamics, contact impulses, or a full constraint Jacobian solver; this document is the target contract for the full solver.
