# Phi Vector Contract (Equation-Only)

$$
\alpha > 0,\quad \varepsilon > 0,\quad s > 0,\quad s_{\text{triad}} > 0,\quad \beta=\mathrm{deg2rad}(\text{seked\_bias\_deg})
$$

## Definitions

$$
p(x,z)=\begin{bmatrix}x\\1\\z\end{bmatrix},\qquad
m(x,z)=\lVert p(x,z)\rVert=\sqrt{x^{2}+1+z^{2}}
$$

$$
h(x,z)=1-e^{-\alpha\,m(x,z)}
$$

$$
\mathrm{slope}(x,z)=\frac{x}{\max(|1|,\varepsilon)}=x
$$

$$
\theta(x,z)=\operatorname{atan2}(1,x)+\beta
$$

$$
E(x,z)=\frac{1}{2}|x|\,|1|\,s_{\text{triad}}=\frac{1}{2}|x|\,s_{\text{triad}}
$$

$$
\operatorname{snap}_s(u)=s\cdot\operatorname{round}\!\left(\frac{u}{s}\right)
$$

$$
p_{\text{snap}}(x,z)=\begin{bmatrix}
\operatorname{snap}_s(x)\\
\operatorname{snap}_s(1)\\
\operatorname{snap}_s(z)
\end{bmatrix}
$$

## (\Phi)-vector

$$
\Phi_x(x,z)=p_{\text{snap},x}(x,z)\cdot\cos(\theta(x,z))\cdot(1+h(x,z))
$$

$$
\Phi_y(x,z)=p_{\text{snap},y}(x,z)\cdot\sin(\theta(x,z))\cdot(1+h(x,z))
$$

$$
\Phi_z(x,z)=p_{\text{snap},z}(x,z)+E(x,z)
$$

$$
\Phi(x,z)=\begin{bmatrix}\Phi_x(x,z)\\\Phi_y(x,z)\\\Phi_z(x,z)\end{bmatrix}
$$

## Visualized scalar field

$$
\mathcal{F}(x,z)=E(x,z)=\frac{1}{2}|x|\,s_{\text{triad}}
$$
