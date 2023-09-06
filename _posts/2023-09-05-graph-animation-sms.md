---
layout: post
title: Animating graphs using spring mass system simulation
subtitle: Physics course finally paid off
cover-img: //assets/img/sms.png
thumbnail-img: /assets/img/sms.png
share-img: /assets/img/sms.png
tags: [physics, simulation, springs, graphs, animation]
toc: true
last-updated: 2023-09-06
---

# Graph animation using spring mass system simulation

This blog post will explain how to implement the animation used for the [`spark-board`](https://github.com/alijdens/spark-board){:target="_blank"} project (see a [live example](https://alijdens.github.io/spark-board/mix/){:target="_blank"}) and looks like this:

{% include spring-mass-system/result.html %}

<center><p style="margin-top: 0; padding-top: 0; color: gray;">
    Try dragging nodes around with the mouse!
</p></center>

Each node in the graph is simulated as a [point mass](https://en.wikipedia.org/wiki/Point_particle#Point_mass){:target="_blank"} and each edge is a spring that connects the nodes. So, essentially, the graph is animated as if it was a [spring-mass system](https://en.wikipedia.org/wiki/Harmonic_oscillator#Spring/mass_system){:target="_blank"} that loses energy over time (otherwise the nodes would bounce eternally).

We'll go through the basic equations needed to simulate the system and then show how to implement it in JavaScript, step by step.

{: .box-note}
<center><b>All the code is available in this <a href="https://codesandbox.io/s/spring-mass-system-pktlhk" target="_blank">CodeSandbox</a></b></center>

## Rendering loop

First of all, we'll need a way to simulate the pass of the time in our system. We'll do this by using [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame){:target="_blank"} and keeping track of how much time has passed between each call. This is the basic structure of the loop:

```js
let lastTime = 0;

function simulate(time) {
    if (lastTime === 0) lastTime = time;

    // calculate the time passed since the last frame call (in milliseconds)
    let elapsed_ms = time - lastTime;
    lastTime = time;

    // do stuff

    requestAnimationFrame(simulate);
}

requestAnimationFrame(simulate);
```

### Constant time step

In the previous snippet the `elapsed_ms` will vary depending on how much time the browser took to render the previous frame so it is not guaranteed to be constant. This is not a problem for most animations, but it is for physical simulations because we will have to do [numerical integrations](https://en.wikipedia.org/wiki/Numerical_integration){:target="_blank"} and these methods usually work best with small time steps (we'll get to this later in the post). For now, let's change the code to make sure we convert the variable `elapsed_ms` to a constant time step:

```js
function simulate(bodies, springs) {
    function loop(time) {
        if (lastTime === 0) lastTime = time;
    
        // calculate the time passed since the last frame call
        let elapsed_ms = time - lastTime;
        if (elapsed_ms > 3000) {
            // too much time passed since the last update, we'll skip this one
            // this could happen if the tab was "paused" by Chrome
            elapsed_ms = 0;
            lastTime = time;
        }
  
        // we'll do 60 steps per second in the physics simulation
        const dt = (1 / 60);
    
        // do constant time step updates to favor numerical stability and reproducibility
        while (elapsed_ms > dt * 1000) {
            // the simulation will be updated in steps of `dt` seconds
            stepSimulation(bodies, springs, dt);

            elapsed_ms -= dt * 1000;
            lastTime += dt * 1000;
        }
    
        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
}
```
<center><p style="margin-top: 0; padding-top: 0; color: gray">
    Code updated to execute many constant time updates to the physical simulation (which will be implemented later). Using a constant time step also ensures that the system will behave exactly the same in slower or faster computers, because the calculations will be the same. If we were to use a variable time step, the simulation could end up being slightly different.
</p></center>

## Coordinates

We'll be using the metric system to describe the physical entities in the simulation. This means that we'll have to translate the coordinates of the nodes in the graph to the coordinates of the canvas. For example, let's say that we have a node with position `(1, 2)`: we will interpret this as if the node was 1 meter to the right and 2 meters up from the origin of coordinates (which we will also have to position in the canvas). In this post we'll set the origin to the center of the canvas (so `(0, 0)` will be the center of the canvas) and that 1000 pixels are equivalent to 1 meter (`1000 ppm`, or 1000 pixels per meter). That said, each time we want to draw some node in the canvas we'll have to convert its coordinates to pixels. It is important to have in mind that:

* the origin of coordinates in the canvas is at the top left corner
* the `y` axis is inverted (positive values go down, negative values go up) as opposed to our usual cartesian coordinates (in which positive `y` values go up).

```js
function drawNode(node) {
    const ppm = 1000; // pixels per meter

    // convert the coordinates to pixels
    let x =  node.x * ppm + canvas.width / 2;
    let y = -node.y * ppm + canvas.height / 2;

    // draw the node
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fill();
}
```


{: .box-note}
**Note:** in reality, it's not strictly necessary to do this conversion. We could just use the same coordinates for the simulation and the canvas (i.e. 1 pixel is equivalent to 1 meter), but this would make it harder to reason about the simulation because everything would be huge (although we wouldn't notice). But if you scale all the constants (masses, spring constants, etc) appropriately, the simulation should work just fine and you would save some CPU work avoiding coordinate conversions. Anyway, this post intends to explain the concepts and won't focus on building the most efficient simulation.

## Newton laws

For this project we'll use [Newton's laws of motion](https://en.wikipedia.org/wiki/Newton%27s_laws_of_motion){:target="_blank"} to calculate the trajectory of each node. The first law states that:

> Every body continues in its state of rest, or of uniform motion in a straight line, unless it is compelled to change that state by forces impressed upon it

This means that we'll need to keep track of objects velocity and we'll use it to update the positions.

```js
// an object that is in the center of the canvas and moving with
// a constant velocity of 5 m/s to the right
const body = {
    pos: { x: 0, y: 0 },
    vel: { x: 5, y: 0 },
}
```

We will only change an object's velocity when a net force is applied to it. This takes us to the second law:

> The change of motion of an object is proportional to the force impressed; and is made in the direction of the straight line in which the force is impressed.

If we assume that the objects have constant mass (which is true in this case), we can rewrite this law as:

$$ acceleration = \sum^i{\frac{F_i}{m}} $$

This means that in order to calculate an objects we will have to calculate all the (vectorial) forces acting on it and sum them up. In our case, the only force acting on the nodes will be that of the springs that connect them, but this could be any force, as long as we know how to calculate it.

### Hook's law

Now that we know that we'll have to calculate the forces acting on each node, we'll have to know how to calculate the force imposed by the springs on the masses. This is where [Hook's law](https://en.wikipedia.org/wiki/Hooke%27s_law){:target="_blank"} comes in handy:

> The force exerted by a spring is proportional to the distance the spring is stretched or compressed from its equilibrium position.

By "equilibrium position" we mean the natural spring's length. For example, is you have a 10cm spring, it will not exert any force. Only when you compress or stretch it it will push or pull, trying to return to the original 10cm. This can be expressed as the following equation:

$$ \vec{F} = -k \Delta \vec{x} $$

Where $$k$$ is the spring constant (a value that models the spring's "stiffness") and $$\Delta x$$ is the deformation from the equilibrium position. Note that that the force of the spring is always directed towards the equilibrium position and it will be stronger the further away the spring is stretched or compressed.

We'll define the springs as objects with the following properties:

```js
const spring = {
    b1: body1,  // the first body connected to the spring
    b2: body2,  // the second body connected to the spring
    len: 0.2,   // the length of the spring at rest (in meters)
    k: 0.8,     // the spring constant (in N/m)
}
```

and the algorithm that we will use to calculate the force will be:

```
calculate the spring deformation:
    calculate the distance between the two bodies connected by a spring
    subtract the length of the spring at rest from the distance between the bodies
calculate the force:
    multiply the deformation by the spring constant
```

> ⚠️ All of these calculations are performed with vectors, so we'll have to calculate the force in the `x` and `y` axis separately.

The following interactive example shows the force that the spring exerts on the attached mass (assuming the other end of the spring is connected to a fixed point):

<iframe src="https://codesandbox.io/embed/spring-mass-system-pktlhk?fontsize=14&hidenavigation=1&hidedevtools=1&module=/src/hooke.mjs,/src/spring-force/elements.mjs&theme=dark&initialpath=/src/spring-force/index.html&forcerefresh=1&view=split"
     style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
     title="spring-mass-system"
     sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
   ></iframe>
<center><p style="margin-top: 0; padding-top: 0; color: gray">
    Drag the mass around with the mouse and see how the force changes. Note how the direction changes when the spring changes from being stretched to being compressed, and how the force is "stronger" (larger arrow) the further away the mass is from the equilibrium position.
</p></center>


## Calculating the new positions

Now that we know how to calculate the force acting on a node due to a spring, we can calculate the acceleration of the node and use it to update its velocity and position. We'll do this by calculating the force of each spring connected to the node and summing them up. We'll use the following algorithm to calculate the forces on every step in the simulation:

```
set all bodies net force to 0

for each spring:
    for each body connected to the spring:
        calculate the force of the spring
        add the force to the body
```

and then, once we have all the forces properly calculated, we'll use them to calculate the accelerations.

In classical physics the acceleration is the second derivative of the position with respect to time, but since we are using discrete time steps we'll have to use the following approximation:

$$ \Delta v = a \cdot \Delta t $$

$$ \Delta x = v \cdot \Delta t $$

<center><p style="margin-top: 0; padding-top: 0; color: gray">
    You can read these equations as "the change in velocity is equal to the acceleration multiplied by the time that has passed" and "the change in position is equal to the velocity multiplied by the time that has passed".
</p></center>

{: .box-warning}
This is just an approximation. We are implicitly assuming that the relation between the acceleration/velocity and the time is linear (for the small amount of elapsed time), which is not true in this case. However, using a small time step (`1/60` in our case) should be good enough.

{: .box-note}
There are better algorithms to numerically integrate the equations of motion, but this one is simple and works well enough for our purposes.

That is, the change in velocity is equal to the acceleration times the time step and the change in position is equal to the velocity times the time step. This is a very simple way of numerically integrating the following equations:

$$ \vec{a} = \frac{d \vec{v}}{d t} $$

$$ \vec{v} = \frac{d \vec{x}}{d t} $$

### Energy loss (damping force)

If we were to simulate the system as we have described it so far, the nodes would bounce forever. In reality, a mass bouncing on a spring would eventually stop moving because of the friction against the surface or the air. We can simulate this by adding a _damp_ force to the nodes. This force will be **proportional to the velocity** of the node and in the **opposite direction**. The algorithm to calculate the damp force will be:

$$ \vec{F}_d = -\vec{v} \cdot d $$

where $$ d $$ is a constant that controls the amount of energy lost (higher $$ d $$ means that the motion stops faster). Note that because this is a new force, the only thing we have to change in the previous algorithm is to sum this too:

```
set all bodies net force to damp force: -v * d

for each spring:
    for each body connected to the spring:
        calculate the force of the spring
        add the force to the body
```

<iframe src="https://codesandbox.io/embed/spring-mass-system-pktlhk?fontsize=14&hidenavigation=1&hidedevtools=1&module=/src/physics.mjs,/src/movement/elements.mjs,/src/engine.mjs,/src/hooke.mjs&theme=dark&initialpath=/src/movement/index.html&forcerefresh=1"
     style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
     title="spring-mass-system"
     sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
   ></iframe>
<center><p style="margin-top: 0; padding-top: 0; color: gray">
    Implementation of the previously explained algorithm. Drag the nodes around with the mouse and see how they move. Notice how the mass slowly loses velocity and ends up still because of the energy loss. Feel free to update the spring and mass parameters and see how they behave.
</p></center>

## Graph animation

We now have all the tools we need to animate a graph. Each **node** in the graph will be assigned to a **mass** and the **edges** will be **springs**. However, we need a way to control how the nodes will end up in the correct position.

### Positioning the nodes

Let's say that we want a node to be positioned at the center of the screen, but do so by bouncing around and then converge over time. We can do this by adding a new node in the center of the screen and connecting it to the node we want to position with a spring. This new positioning node will have **infinite mass** so that it won't move. Remember that Newton states that $$ a = \frac{F}{m} $$ so if $$ \lim_{m \to \infty} a = 0 $$. We will also set the **spring length to 0**, so that the node is pulled into the same position as the infinite mass node:

<iframe src="https://codesandbox.io/embed/spring-mass-system-pktlhk?fontsize=14&hidenavigation=1&hidedevtools=1&module=/src/positioning/elements.mjs&theme=dark&initialpath=/src/positioning/index.html&forcerefresh=1"
     style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
     title="spring-mass-system"
     sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
   ></iframe>
<center><p style="margin-top: 0; padding-top: 0; color: gray">
    Drag the black node and release it. Note how the fixed mass (red) forces the node to the center of the screen by pulling it with a 0 length spring. By adding a damping factor we make the node lose energy and eventually fall in place. Feel free to change the parameters and experiment with different mass values, <i><b>k</b></i> or <i><b>damp</b></i> parameters.
</p></center>

### Dimensioning the springs

As we mentioned before, the graph edges will become springs so that pulling from a node will indirectly apply a force on the connected nodes, causing the "wave" effect over the graph. It is important, however, to **assign the appropriate length** to each spring. For example, if we wanted to place 2 nodes at a distance of 20cm apart, we need to make sure that the spring length is also 20cm. Otherwise, the nodes will **not** be positioned correctly when all energy is lost, because even if the fixed nodes force them in position, the spring will still apply a force on them that prevent them from reaching the fixed nodes. The following example shows 2 pairs of nodes, one with the correct spring length and the other one with a shorter one:

<iframe src="https://codesandbox.io/embed/spring-mass-system-pktlhk?fontsize=14&hidenavigation=1&hidedevtools=1&module=/src/spring-length/elements.mjs&theme=dark&initialpath=/src/spring-length/index.html&forcerefresh=1"
     style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
     title="spring-mass-system"
     sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
   ></iframe>
<center><p style="margin-top: 0; padding-top: 0; color: gray">
    Notice how the second pair does not end up in the corresponding red node's position. This is because the spring is too short and it keeps pulling the nodes together.
</p></center>

### Final touches

We now have all the required pieces to build the complete graph animation. In order to get the same results as the first example in the post, we just have to hide the fixed nodes (that so far we've been painting them red to illustrate the trick), hide the springs that connect the hidden to the moving nodes and draw the springs as simple lines.

Finally, it's just a matter of organizing the nodes in the screen (using any layout you prefer), assign the proper lengths to the springs (which can ba calculated using the [distance formula](https://en.wikipedia.org/wiki/Euclidean_distance){:target="_blank"}) and let the simulation run.

<iframe src="https://codesandbox.io/embed/spring-mass-system-pktlhk?fontsize=14&hidenavigation=1&hidedevtools=1&module=/src/result/elements.mjs&theme=dark&initialpath=/src/result/index.html&forcerefresh=1"
     style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
     title="spring-mass-system"
     sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
   ></iframe>
<center><p style="margin-top: 0; padding-top: 0; color: gray">
    Final result. Feel free to show the fixed nodes to see how they are positioned by modifying the variables in the editor.
</p></center>
