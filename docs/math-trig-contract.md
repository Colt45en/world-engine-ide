# Trig Contract (Operator DAG + Continuation Constraints)

Add this _before_ any calculations that depend on trigonometric / inverse-trigonometric functions.

```text
# 1) Operator graph (single DAG)

## Primitives

[
\mathcal P={+,-,\times,/, \exp,\Log,\sqrt{\cdot}_{\mathrm{pr}},\;\mathrm{Re},\mathrm{Im}}
]
[
\mathcal K={0,1,i,\pi,2\pi,\tfrac{\pi}{2}}
]

## Derived core nodes

[
\sin \leftarrow {\exp,+,-,\times,/}
]
[
\cos \leftarrow {\exp,+,-,\times,/}
]
[
\\tan \leftarrow {\sin,\cos,/}
]
[
\cot \leftarrow {1,\tan,/}
]
[
\sec \leftarrow {1,\cos,/}
]
[
\csc \leftarrow {1,\sin,/}
]
[
\sinc \leftarrow {\sin,/, \mathrm{Piecewise}}
]

## Inverses (principal branches)

[
\asin \leftarrow {\Log,\sqrt{\cdot}_{\mathrm{pr}},+,-,\times}
]
[
\acos \leftarrow {\asin,\pi,+,-}
]
[
\atan \leftarrow {\Log,+,-,\times,/}
]
[
\acot \leftarrow {\atan,\pi,+,-}
]
[
\asec \leftarrow {\acos,/}
]
[
\acsc \leftarrow {\asin,/}
]
[
\atan2 \leftarrow {\atan,\Log,\sqrt{\cdot}_{\mathrm{pr}},\mathrm{Piecewise},\mathrm{Arg}}
]

---

# 2) Analytic continuation constraints (domains + branch cuts only)

## Global conventions

[
\Arg(z)\in(-\pi,\pi],\qquad \Log(z)=\ln|z|+i\Arg(z)
]
[
\sqrt{\cdot}_{\mathrm{pr}}:\;\Arg(\sqrt z)=\tfrac12\Arg(z)\in\left(-\tfrac{\pi}{2},\tfrac{\pi}{2}\right]
]

---

## Entire functions (no branch cuts)

[
\sin:\mathbb C\to\mathbb C,\quad \cos:\mathbb C\to\mathbb C
]

## Meromorphic functions (no branch cuts; poles only)

[
\\tan:\mathbb C\setminus{z:\cos z=0}\to\mathbb C,\qquad \text{poles at } z=\tfrac{\pi}{2}+k\pi
]
[
\cot:\mathbb C\setminus{z:\sin z=0}\to\mathbb C,\qquad \text{poles at } z=k\pi
]
[
\sec:\mathbb C\setminus{z:\cos z=0}\to\mathbb C
]
[
\csc:\mathbb C\setminus{z:\sin z=0}\to\mathbb C
]

## (\sinc) (removable singularity)

[
\sinc:\mathbb C\to\mathbb C\quad \text{(analytic continuation with removable singularity at }0)
]

---

## Inverse trigonometric (principal branches)

### (\asin)

[
\asin:\mathbb C\setminus\Big(( -\infty,-1]\cup[1,\infty)\Big)\to\mathbb C
]
[
\\text{branch points: }{-1,1},\qquad \text{cuts: }(-\infty,-1]\cup[1,\infty)
]
[
\Re(\asin x)\in\left[-\tfrac{\pi}{2},\tfrac{\pi}{2}\right]\ \text{for }x\in[-1,1]
]

### (\acos)

[
\acos:\mathbb C\setminus\Big(( -\infty,-1]\cup[1,\infty)\Big)\to\mathbb C
]
[
\\text{branch points: }{-1,1},\qquad \text{cuts: }(-\infty,-1]\cup[1,\infty)
]
[
\Re(\acos x)\in[0,\pi]\ \text{for }x\in[-1,1]
]

### (\atan)

[
\atan:\mathbb C\setminus\Big(i[1,\infty)\cup(-i)[1,\infty)\Big)\to\mathbb C
]
[
\\text{branch points: }{\;i,\,-i\;},\qquad \text{cuts: } i[1,\infty)\cup(-i)[1,\infty)
]
[
\Re(\atan x)\in\left(-\tfrac{\pi}{2},\tfrac{\pi}{2}\right)\ \text{for }x\in\mathbb R
]

### (\acot)

[
\acot:\mathbb C\setminus[-i,i]\to\mathbb C
]
[
\\text{branch points: }{\;i,\,-i\;},\qquad \text{cut: }[-i,i]
]
[
\Re(\acot x)\in\left(-\tfrac{\pi}{2},\tfrac{\pi}{2}\right]\ \text{for }x\in\mathbb R
]

### (\asec)

[
\asec:\mathbb C\setminus[-1,1]\to\mathbb C
]
[
\\text{branch points: }{-1,1,0},\qquad \text{cut: }[-1,1],\quad \asec(0)=\infty
]

### (\acsc)

[
\acsc:\mathbb C\setminus[-1,1]\to\mathbb C
]
[
\\text{branch points: }{-1,1,0},\qquad \text{cut: }[-1,1],\quad \acsc(0)=\infty
]

### (\atan2(y,x))

Real principal range:
[
\atan2:\mathbb R^2\setminus{(0,0)}\to(-\pi,\pi]
]
Complex continuation (inherits (\Log,\sqrt{\cdot}_{\mathrm{pr}}) cuts through the quotient argument):
[
\atan2:{(y,x)\in\mathbb C^2:\ x^2+y^2\neq 0}\to\mathbb C
]

---

# 3) Functional identities (equational constraints)

## Parity

[
\sin(-z)=-\sin(z),\qquad \cos(-z)=\cos(z)
]
[
\\tan(-z)=-\tan(z),\qquad \cot(-z)=-\cot(z)
]
[
\sec(-z)=\sec(z),\qquad \csc(-z)=-\csc(z)
]

## Periodicity

[
\sin(z+2\pi)=\sin(z),\qquad \cos(z+2\pi)=\cos(z)
]
[
\\tan(z+\pi)=\tan(z),\qquad \cot(z+\pi)=\cot(z)
]
[
\sec(z+2\pi)=\sec(z),\qquad \csc(z+2\pi)=\csc(z)
]

## Reciprocal constraints

[
\sec(z)=\frac{1}{\cos(z)},\qquad \csc(z)=\frac{1}{\sin(z)},\qquad \cot(z)=\frac{1}{\tan(z)}
]

## Removable singularity constraint for (\sinc)

[
\sinc(z)=\frac{\sin z}{z}\ \ (z\neq 0),\qquad \sinc(0)=1
]

---

# 4) Differential constraints (equations)

[
\frac{d}{dz}\sin z=\cos z
]
[
\frac{d}{dz}\cos z=-\sin z
]
[
\frac{d}{dz}\tan z=1+\tan^2 z=\sec^2 z
]
[
\frac{d}{dz}\cot z=-(1+\cot^2 z)=-\csc^2 z
]
[
\frac{d}{dz}\sec z=\sec z,\tan z
]
[
\frac{d}{dz}\csc z=-\csc z,\cot z
]
[
\frac{d}{dz}\sinc z=\frac{\cos z}{z}-\frac{\sin z}{z^2}\quad(z\neq 0)
]

Inverse derivatives (principal branches, away from branch points/cuts):
[
\frac{d}{dz}\asin z=\frac{1}{\sqrt{1-z^2}_{\mathrm{pr}}}
]
[
\frac{d}{dz}\acos z=-\frac{1}{\sqrt{1-z^2}_{\mathrm{pr}}}
]
[
\frac{d}{dz}\atan z=\frac{1}{1+z^2}
]
[
\frac{d}{dz}\acot z=-\frac{1}{1+z^2}
]
[
\frac{d}{dz}\asec z=\frac{1}{z^2\sqrt{1-\frac{1}{z^2}}_{\mathrm{pr}}}
]
[
\frac{d}{dz}\acsc z=-\frac{1}{z^2\sqrt{1-\frac{1}{z^2}}_{\mathrm{pr}}}
]

For (\atan2(y,x)) on (\mathbb R^2\setminus{(0,0)}):
[
\frac{\partial}{\partial y}\atan2(y,x)=\frac{x}{x^2+y^2},\qquad
\frac{\partial}{\partial x}\atan2(y,x)=-\frac{y}{x^2+y^2}
]

---

# 5) Quadrant / principal-range constraint for (\atan2) on (\mathbb R^2)

[
\atan2(y,x)=
\begin{cases}
\atan\!\left(\frac{y}{x}\right), & x>0\\[4pt]
\atan\!\left(\frac{y}{x}\right)+\pi, & x<0,\ y\ge 0\\[4pt]
\atan\!\left(\frac{y}{x}\right)-\pi, & x<0,\ y<0\\[4pt]
+\frac{\pi}{2}, & x=0,\ y>0\\[4pt]
-\frac{\pi}{2}, & x=0,\ y<0\\[4pt]
\\text{undefined}, & x=0,\ y=0
\end{cases}
]
```
