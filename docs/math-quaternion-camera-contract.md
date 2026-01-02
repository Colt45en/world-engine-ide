# Quaternion + Camera + Projection Contract (Equation-Only)

## 1) Quaternion primitives

$$
q=(x,y,z,w)=\bigl(\mathbf{v},w\bigr),\quad \mathbf{v}\in\mathbb{R}^3,\; w\in\mathbb{R}
$$

### Magnitude

$$
\lVert q\rVert=\sqrt{x^2+y^2+z^2+w^2}
$$

### Conjugate

$$
q^{*}=(-x,-y,-z,w)=(-\mathbf{v},w)
$$

### Inverse

$$
q^{-1}=\frac{q^{*}}{\lVert q\rVert^{2}}\quad (q\neq 0)
$$

### Hamilton product

For $q_1=(\mathbf{v}_1,w_1)$, $q_2=(\mathbf{v}_2,w_2)$:

$$
q_1 q_2=
\left(
w_1\mathbf{v}_2+w_2\mathbf{v}_1+\mathbf{v}_1\times\mathbf{v}_2,\
w_1w_2-\mathbf{v}_1\cdot\mathbf{v}_2
\right)
$$

## 2) Axis–angle $\to$ quaternion

Let $\hat{\mathbf{a}}=(a_x,a_y,a_z)$ be a unit axis and $\theta\in\mathbb{R}$:

$$
q(\hat{\mathbf{a}},\theta)=\left(\hat{\mathbf{a}}\sin\frac{\theta}{2},\;\cos\frac{\theta}{2}\right)
$$

Expanded component form:

$$
q(\hat{\mathbf{a}},\theta)=\left(a_x\sin\frac{\theta}{2},\;a_y\sin\frac{\theta}{2},\;a_z\sin\frac{\theta}{2},\;\cos\frac{\theta}{2}\right)
$$

For $\hat{\mathbf{a}}=(0,0,1)$, $\theta=\frac{\pi}{2}$:

$$
q_{90z}=\left(0,0,\sin\frac{\pi}{4},\cos\frac{\pi}{4}\right)=\left(0,0,\frac{\sqrt2}{2},\frac{\sqrt2}{2}\right)
$$

## 3) Rotating a 3D point by a quaternion

Embed $\mathbf{p}=(p_x,p_y,p_z)$ as a pure quaternion:

$$
P=(\mathbf{p},0)=(p_x,p_y,p_z,0)
$$

For unit quaternion $q$:

$$
P'=q\,P\,q^{-1}
$$

Define the rotation operator:

$$
\operatorname{rot}(q,\mathbf{p})=\operatorname{vec}(P')
$$

## 4) Lattice rotation over time

Let the lattice spin around $Z$ with angular speed $\omega$ (radians/sec). With elapsed time $t$:

$$
\theta(t)=\omega t
$$

$$
q_L(t)=q\bigl((0,0,1),\theta(t)\bigr)=\left(0,\;0,\;\sin\frac{\omega t}{2},\;\cos\frac{\omega t}{2}\right)
$$

Any node base position $\mathbf{n}_i$ becomes

$$
\mathbf{n}_i^{\mathrm{world}}(t)=\operatorname{rot}\bigl(q_L(t),\mathbf{n}_i\bigr)
$$

## 5) Camera pose (quaternion orientation + position)

Let camera rotation quaternion be $q_C$ (unit), and camera position be $\mathbf{c}\in\mathbb{R}^3$.

World point $\mathbf{p}^{\mathrm{world}}$ to camera coordinates:

$$
\mathbf{p}^{\mathrm{cam}}=\operatorname{rot}\bigl(q_C^{-1},\;\mathbf{p}^{\mathrm{world}}-\mathbf{c}\bigr)
$$

## 6) Projection to screen + legacy zoom/pan

Let $\mathbf{p}^{\mathrm{cam}}=(X,Y,Z)$.

Representative perspective projection:

$$
x_{\mathrm{ndc}}=\frac{fX}{Z},\qquad y_{\mathrm{ndc}}=\frac{fY}{Z}
$$

Apply legacy zoom $z$, pan $(p_x,p_y)$, and viewport center $(W/2,H/2)$:

$$
x_{\mathrm{screen}}=\frac{W}{2}+z\,x_{\mathrm{ndc}}+p_x
$$

$$
y_{\mathrm{screen}}=\frac{H}{2}-z\,y_{\mathrm{ndc}}+p_y
$$

(Orthographic projection drops the $1/Z$ terms; the rest is identical in form.)

## 7) Snapshot contents (pure math objects)

At tick $k$, elapsed $t_k$:

$$
q_L(t_k)
$$

$$
(q_C,\mathbf{c})
$$

$$
\mathbf{n}_i^{\mathrm{world}}(t_k)=\mathrm{rot}\bigl(q_L(t_k),\mathbf{n}_i\bigr)
$$

$$
\mathbf{n}_i^{\mathrm{cam}}(t_k)=\operatorname{rot}\bigl(q_C^{-1},\;\mathbf{n}_i^{\mathrm{world}}(t_k)-\mathbf{c}\bigr)
$$

$$
\mathbf{n}_i^{\mathrm{screen}}(t_k)=\Pi\bigl(\mathbf{n}_i^{\mathrm{cam}}(t_k)\bigr)
$$

Edges $(i,j)$ render as line segments:

$$
\left[\mathbf{n}_i^{\mathrm{screen}}(t_k),\;\mathbf{n}_j^{\mathrm{screen}}(t_k)\right]
$$

## 8) SLERP equation

For unit quaternions $q_0,q_1$, define:

$$
d=q_0\cdot q_1=x_0x_1+y_0y_1+z_0z_1+w_0w_1
$$

If $d<0$, set $q_1\leftarrow -q_1$ and $d\leftarrow -d$.

$$
\Omega=\arccos(d)
$$

For $t\in[0,1]$ and $\sin\Omega\neq 0$:

$$
\operatorname{slerp}(q_0,q_1,t)=
\frac{\sin((1-t)\Omega)}{\sin\Omega}\,q_0+
\frac{\sin(t\Omega)}{\sin\Omega}\,q_1
$$

Angle represented by a unit quaternion $q=(\mathbf{v},w)$:

$$
\theta=2\arccos(w)
$$

## 9) Single composed mapping (node $\to$ screen)

$$
\mathbf{n}_i^{\mathrm{screen}}(t)=
\Pi\Bigl(
\operatorname{rot}\bigl(q_C^{-1},\;\operatorname{rot}(q_L(t),\mathbf{n}_i)-\mathbf{c}\bigr)
\Bigr)
$$

## 10) Closed-form rotation operator (vector algebra only)

For a unit quaternion $q=(\mathbf{v},w)$:

$$
\operatorname{rot}(q,\mathbf{p})=\mathbf{p}+2w(\mathbf{v}\times\mathbf{p})+2\bigl(\mathbf{v}\times(\mathbf{v}\times\mathbf{p})\bigr)
$$
