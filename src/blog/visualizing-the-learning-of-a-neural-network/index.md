---
layout: post.njk
title: "Visualizing the learning of a neural network"
description: "Part I - The Convolution"
date: 2022-12-18
cover: "./cover.jpg"
coverAlt: "Visualizing the learning of a neural network"
sourceUrl: "/blog/visualizing-the-learning-of-a-neural-network/"
tags:
  - "posts"
  - "technical"
---

## Part I - The Convolution

#Honestly_I_do_not_know_where_to_begin_from. There are so many visualizations of an Artificial Neural Network (abbreviated as ANN) out there on the internet, showing mind blowing, cool visualizations of a neutral network [1,2,3] ...

Here is an example in fig 1. This is what a NN sees in the image of Mona Lisa, when back-propagated through the NN architecture of VGG [4]. It's finding dogs everywhere because the ImageNet dataset VGG is trained on contains well over 100 breeds of dog images, so it tries to find features of dog wherever possible.

But I am interested in doing something different (as always). I want to visualize how an NN learns throughout its entire process of training. Try different techniques to get some intuition of a NN

The basic building blocks of a NN are its weights or the parameters. For a convolution-based NN or a CNN [5], it's a kernel or filters that runs through the input image

Let's familiarise what a kernel is (If you are someone who worked on ML, then you know this part better than me). So a kernel is a simple n X n matrix that convolves through an image, as shown in the gif here (The yellow one). This kernel is what extracts the features of an image, like the edges, curves, colors, relation between pixels and more. There is an entire mathematics behind all this [6,7]. (I will explain some of it below )

Kernel is learning how to differentiate an image of a dog from that of a Cat. Throughout the process of learning, the kernel is updated millions of times, adjusting its weights to recognise the relation between pixels. These filters/kernels are learning to recognise edges, curves, patterns and hundreds of different features of an image or dataset. These kernels are basically a matrix of random values (called weights) at beginning and as the entire architecture learns and trains, these weights are fine tuned with a learning goal of classification, recognition, detection etc.. with help of a loss function or a criterion.

This learning process is what we visualize now. In VGG-16 a variant of VGG having 16 layers, this is the model I trained on Kaggle with tiny-ImageNet dataset (source code). We will see how the value of this kernel change from random values, so that our NN can learn to do the things we want.

But before we need to understand the working of a CNN or VGG-16 in this context.

CNN takes images as input, to be specific pixel values. Let's zoom into the picture of this cute cat. If we zoom enough to see the actual pixel contents of the image, we can see the individual pixels made of RGB values [8].

As shown in the gif, the kernel marches the entire image one stride by stride and it updates its weights during the back-propagation. There are 64 kernels in the first layer of VGG-16, which means 64 different pattern identifiers. 64 kernels in the second layer and so on till 512 kernels at the last conv layer. In a total of 13 convolutional layers. In fig 4, I have shown one kernel sliding throughout the green channel of the image.

Some layers shrink the size of the input. If it has a stride or with a separate layer called max pool, Max pool layers do not have any kernels.

In fig 5, I have shown the output from vgg16 trained by PyTorch. Each kernel returns an output that represents features, as you can see some kernel are recognising the curves in the fur of cat. Some recognise the contours or edges in the cat's fur.Each layer extracting more and more complex features of the image, as we go deep into the network.

## (Fig 5 is shown in green tone instead of gray-scale)

Convolution operation is a matrix multiplication as explained by PyTorch, a cross correlation between two matrices. It is element vice matrix multiplication (If you want to know more about matrix algebra, go through these wiki pages [9,10]). I know mathematics is boring and hard. Here you don't need to know more, just basic addition and multiplication.

Let's get an intuition of what these kernels learn. when you multiply a matrix with another, you can think that the resulting matrix/output (Fig 5 for instance) is an enhanced/ exaggerated feature of the image. An edge detecting kernel exaggerates all the edges of an image [11].

If you look at these images in fig 6, you find absolutely no difference, but look closely. These are two simple image edge kernels, detecting edges and enhancing them for the next layer. One kernel enhances horizontal edges and one vertical edge.

Uff, finally our kernels do something, but this is not what we want to visualize. We want to visualize how our kernels get there, to a place where they can do feature extraction. The learning process.

In the next post.
