---
layout: post.njk
title: "Do floating-point numbers really float in your computer?"
description: "Learn how floating point, decimal , fraction are stored in the computer memory. With C, C++ program. Coading ,techinical writing."
date: 2022-11-09
cover: "./cover.jpg"
coverAlt: "Do floating-point numbers really float in your computer?"
sourceUrl: "/blog/do-floating-point-numbers-really-float-in-your-computer/"
tags:
  - "posts"
  - "technical"
---

If you have ever worked with floating point numbers. In any programming language, floating point arithmetic seems daunting. Especially if your compiler/interpreter uses IEEE 754 format of floating point representation.

But what the heck is the IEEE 754 format? and why do floats behave the way they do in computers?

Let's find the answers to those. But in a non-conventional way.

Let's start with you. Yes, you. Try remembering the value of π. Let me help you. Which is 3.141592653589793238462643383279. Yeah, go on. Give it a shot.

How many digits could you remember? Technically, one could remember as many digits as possible (this is the word record). But practically, it makes sense to remember only up to some decimal places. Applicable to humans and as well as computers. So that's why people from IEEE, standardized a format of how computers can efficiently represent, and store as many numbers as possible in a finite memory.

If you were the one designing the IEEE standards, how would you do it? If you want more numbers to be stored in limited memory. Limited memory means just 32 bits. Assume this as if you have just 32 blocks to represent π in binary, the language computers understand.

Fig 1. Fixed point notation.

The easiest way is to fix our decimal point (.) at bit position 15. And say store 3 from 0 to 15 bits as 0000000000000011 and the remaining values 0.141592653589793238462643383279 from

16 to 31 bits as 0010010000111111 (From 0.00100100001111110111....).

If you notice, the issue is, we can only represent half the numbers. From 0 to 65535, without no sign. From 32 bits to 15 bits for the integer part. The same applies to the fractional part. This is called the fixed point decimal representation. If you convert the binary back to decimal, you lose your precision. For instance, if you convert 0.00100100001111110111 back to decimal, we get 0.14159297943115234375. We can do better.

But for our system, we can define a value called machine epsilon. It is the smallest possible float value we can represent. Other than zero, with our system. For instance, we have 16 bit space for our fraction. So the smallest float will be 0.0000000000000001 (0.0000152587890625). We cannot represent a number any smaller than this. We cannot add, subtract any number smaller than this. This poses a problem of accuracy for us.

## Let's reverse engineer and see how the computer stores these floating values in memory

As we talked about the IEEE 754 format, we convert the number to a normalized form. Or in decimal we call it scientific notation. For instance,we can convert our epsilon 0.0000152587890625 as.

Fig 2. I am going to use a bit of math knowledge, bare with me.It will be easy (Hopefully).

We just picked the first non-zero digit placed a decimal point by adjusting our power of ten accordingly. We do the same in binary.

## Fig 3. As our base is 2, we replace 10 with 2

In this normalised form, the computer stores fractions in its memory, but with some twist.

## Fig 4. 32 bit IEEE float representation

We reserve 31 bit for the sign of the number (s), 0 if positive and 1 if the number is negative. Reserve bits 23 to 30 for the exponent (e. Remember, we do not store 2 -16, instead just -16) and remaining bits for the mantissa (m). For exponent we add a bias value of 127, to include both negative and positive number. From (-127, to 127). If we want to store -16, we add 127 to -16 and store 111 (01101111), in bit position 30 to 23.

To store 1.00, we only have to store values right of the decimal point. We know that it's always 1 on the left of decimal point, no need to store it. But while reconstructing back the number, we need to consider this forgotten 1.

So finally, what all we are storing in the memory? Sign (0), exponent (01101111), mantissa (00000000000000000000000000000000).

Fig 5. 0.0000152587890625 stored in 32 bit memory space.

Let's see how my computer is storing a number by poking into memory.

But before, with any programming language, I did not find any direct method of accessing the binary value stored in the memory, especially for floating point. The compiler or interpreter returns us the decimal equivalent of the binary stored in the memory. So I wrote a small piece of code, which lets us see the actual memory content. Inspired by the Fast inverse square root algorithm. See full code.

## Fig 6. Reading memory content of float value and output

Waw, our calculations match to that of our computers output. let's try for π and decode back our value. I took π from math.h lib from C and the memory contents are 01000000010010010000111111011011. Let's decode it back.

It's an error of approx 0.0000000874227801, pretty accurate.

The reason for the error is the rounding we need to do because of limited memory space. We cannot represent some numbers perfectly with binary. For instance, in decimal, 1/27 which is 0.0370370370370370 recurring infinitely. In fact, my program rounded it off to 0.037037037037037035. The same problem occurs in storing 0.3 in binary 0.01001100110011001101 recurring. When converted, it is not 0.3 exactly. It was truncated and rounded off, to fit the memory of 32 bit block.

## Now let's check why 0.2 + 0.1! = 0.3

## 0.2 as 00111110010011001100110011001101

## 0.1 as 00111101110011001100110011001101

## 0.3 as 00111110100110011001100110011010 if you decode them all

0.10000000149011611938, 0.20000000298023223877, 0.30000001192092895508. Which are clearly not adding up

Your computer does not know that 0.2 + 0.1 should add up to 0.3, it just does what they instruct it to do. Which is ironically to perform addition (in binary).
