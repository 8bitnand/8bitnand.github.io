---
layout: post.njk
title: "Breaking Bits, a dive into bitwise NOT (~)"
description: "I was working on an ML model and I stumbled on the task of writing my loss function. Interestingly, I had to use a bitwise operator, among other operations, on an image. To convert it into a sketch. As I blindly plug..."
date: 2023-05-14
cover: "./cover.png"
coverAlt: "Breaking Bits, a dive into bitwise NOT (~)"
sourceUrl: "/blog/breaking-bits-a-dive-into-bitwise-not/"
tags:
  - "posts"
  - "ml"
  - "bitwise-operators"
  - "not"
  - "color-wheel"
---

I was working on an ML model and I stumbled on the task of writing my loss function. Interestingly, I had to use a bitwise operator, among other operations, on an image. To convert it into a sketch.

As I blindly plugged the bitwise NOT operator into the loss function, the interpreter throws me an error `RuntimeError: "bitwise_not_cpu" not implemented for 'Float'` Of course, bitwise operations do not make any sense on floating point numbers. So I converted them to int32 and tried the loss function.

As I used this loss function, my loss showed to be `nan` (Not a number) and `inf` (infinite). I thought it might be because of the bitwise NOT operation I am using (It was not! The error was because of a completely different thing). So I dig a little into the NOT operator, in the context of ML.

As my loss value is `nan`, my only assumption is the derivative of the NOT function is not defined at the edge cases, which might be the reason for getting `nan` values for my loss.

If you look into the graph of NOT it would look something like.

<iframe src="https://www.desmos.com/calculator/xel9zzw7sc?embed" width="500" height="500" style="border:1px solid #ccc"></iframe>

But this works only in the realm of binary numbers,

$$\displaylines {F(x) = NOT(x) = \begin{cases}1&(x=0)\\0&(x=1)\end{cases} \\ F'(x) = -1 }$$

If you try taking the derivative of the function `F(x)` wrt real numbers, it would return `inf` at x = {0, 1}. The derivative we just got `F'(x)` perfectly fits binary numbers `0 <= x <= 1`. But this is not the way to take the derivative. It is completely wrong to take the derivative of a binary function in decimal relm.

I did not realize this mistake early. I thought this was the reason for my `inf` values of loss.

After it made sense, I started looking for other methods of representing NOT function.

![](./image-01.jpg)

If you move to the realm of colors, NOT operation can be used in complementary color generation.

consider color value hex #164C10 (RGB - 22 76 16). which almost corresponds to the green color in the image of Breaking Bits. Its complementary color #46104C (70, 16, 76) is obtained by flipping the bits with the NOT operator. The above images are obtained just by flipping the RGB values of the image with the NOT operator with cv2.

```python
import cv2
img = cv2.imread("Breaking Bad image.png")
img = cv2.bitwise_not(img)
```

Another formula/ method to get the same complementary colors is by subtracting RGB values from 256( hex - 0xFF ). This means our function for the NOT operator in real numbers is just a subtraction operation.

$$\displaylines {F(x) = 256 - X_{C} \\ c = \begin{cases} r,g,b \end{cases} \\ }$$

Assuming our color palate supports 256 RGB channels. Below I plotted the same image using both methods: bit flip and subtracting from 256. I got the same image.

After digging a lot I found this Pytorch implementation of [bitwise\_NOT](https://github.com/pytorch/pytorch/blob/65412f95f0d17861d79e5031717266d8bdcd6b09/torch/_inductor/codegen/common.py#L270) use it for further reading.

![](./image-02.png)

Now that we have our function defined for the NOT operator on the integer number realm, let's find out its derivative. Let's plot the function first. As we have to functions for the NOT operator. One represented by **subtraction** and one by **~** method.

<iframe src="https://www.desmos.com/calculator/ulrek04zkc?embed" width="500" height="500" style="border:1px solid #ccc"></iframe>

And you guessed it right the derivative is -1. You might ask why are there two different graphs. It's because when I tried flipping bits with the `~`, `cv2.bitwise_not`, `torch.bitwise_not` they return values as negative numbers (Blue line). I presume it is because of how negative numbers are stored in a computer: as 2's complement. But when I tried NOT on images with CV2, torch they returned a subtraction-based operation.

That is it for the Bitwise NOT operator.

It's pretty fascinating how one domain of computer science (color theory) can be used to understand other domains of computer science (#ML, Binary operation on Bits).

If you want to read more on computers read this [page](/blog/floating-point-numbers/).
