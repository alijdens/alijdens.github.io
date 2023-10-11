---
layout: post
title: Auto-resizable C arrays
subtitle: Because I'm too lazy to use `realloc`
cover-img: /assets/posts/varray/header.jpg
thumbnail-img: /assets/posts/varray/header.jpg
share-img: /assets/posts/varray/header.jpg
tags: [C, programming, array, dynamic, resizable, varray]
toc: true
last-updated: 2023-10-11
---

# Auto-resizable C arrays

## Disclaimer

I did not invent this particular method of implementing resizable arrays. I read about the _idea_ behind it so I wrote my own implementation.

If you are not interested in the implementation details and want the code right away you can find it here:
* [`varray.h`](https://github.com/alijdens/zip-stream/blob/7e3c75946d11e2aa7c37b974aa5c76f1ffd88d90/src/varray.h)
* [`varray.c`](https://github.com/alijdens/zip-stream/blob/7e3c75946d11e2aa7c37b974aa5c76f1ffd88d90/src/varray.c)
* [`varray_t.c`](https://github.com/alijdens/zip-stream/blob/7e3c75946d11e2aa7c37b974aa5c76f1ffd88d90/tests/varray_t.c) (tests written using [`scunit`](https://github.com/alijdens/zip-stream/blob/7e3c75946d11e2aa7c37b974aa5c76f1ffd88d90/tests/scunit.h), a testing library written by [mchouza](https://github.com/mchouza)).

## Introduction

Let's start by explaining this post's objective: we want to build a data structure that behaves like a C array, but that is resized automatically when we add more elements in order to for the required size. This is useful when we don't know the size of the array beforehand, or when we want to add elements to it without worrying about its size.

The first idea that might occur to you is to write an abstraction around `realloc`, keeping track of the array size and the pointer. Something like this:

```c
typedef struct {
    size_t size;
    size_t elem_size;
    void *ptr;
} array_t;

void array_init(array_t *a, size_t initial_size, size_t elem_size) {
    array->size = initial_size;
    array->elem_size = elem_size;
    array->ptr = malloc(initial_size * elem_size);
}

void array_push(array_t *a, void *elem) {
    a->size++;
    a->ptr = realloc(a->ptr, a->size * a->elem_size);
    memcpy(a->ptr + (a->size - 1) * a->elem_size, elem, a->elem_size);
}
```

and it could be used like this:

```c
// create an array to store ints
array_t a;
array_init(&a, 10, sizeof(int));

for (int i = 0; i < 100; i++) {
    array_push(&a, &i);
}
```

This works but it has a few problems (at least from my point of view):

1. we have use `void *` in the interface, which wouldn't defend us from accidentally passing the wrong type of pointer to `array_push` (e.g. `array_push(&a, "hello")` would compile but it would be wrong).
2. we have to pass a pointer to `array_push` instead of the value itself, which is a bit annoying in some cases.

Another option would be to create a different instance of this array specialized for each type we want to use. This would solve the first problem, but it would be a lot of work to write and maintain all the different versions of the array. In some cases, you might not need too many versions because you'd use it for a couple of different types, and that's ok. In this post however, we assume you'll need to use it for many different types and we'll come up with a solution that works with any data type and still maintains type safety (although this implementation won't be perfect, but it's all about tradeoffs).

## Objective

We will implement an array that will look similar to native C pointers but still resize automatically when needed. We will call this data structure a `varray_t` (variable array):

```c
// varrays are declared as normal pointers and then must be
// initialized using varray_init
// the type of the pointer defines the elements.
// for example, to create a varray of ints:
int *va = NULL;
varray_init( va, 1 );  // with pre-allocated space for 1 element

// pushing elements resizes the array under the hood
// the array is resized to fit the new elements
varray_push( va, 123 );
varray_push( va, 0 );
varray_push( va, -1 );
varray_push( va, 1235 );

// using pop reduces the length (but does not decrease the
// allocated buffer)
printf( "%d\n", varray_pop( va ) );  // 1235

// elements can be accessed using native C syntax
printf( "%d\n", va[0] );  // 123
printf( "%zu\n", varray_len( va ) );       // 3
printf( "%zu\n", varray_capacity( va ) );  // 4

// you can also reassign elements like a normal array
va[0] = 0;

// attempting to push a different type results in a compile error
varray_push( va, 0.5 );  // COMPILE ERROR!

varray_release( va );
```

{: .box-note}
You can use any type, even `struct`s, check out [this](https://github.com/alijdens/zip-stream/blob/7e3c75946d11e2aa7c37b974aa5c76f1ffd88d90/tests/varray_t.c#L116-L144) test.

## The key idea behind this

Wait... if the array is declared as a pointer, how does it know its size?? This is sorcery!

Well, this is the important idea that I mentioned in the beginning of the post. In reality, the `varray` is a structure very similar to the one described in the first implementation example, but the way it is implemented is hiding away the fact that it is a `struct`. The `varray` is actually a pointer to a structure that contains the pointer to the array and its size. This is the actual `varray_t`:

```c
typedef struct
{
  /** Size of the internal buffer (in element units). */
  size_t capacity;

  /** Number of elements allocated. */
  size_t len;

  /** Actual buffer of data. */
  uint8_t data[];

} varray_t;
```

{: .box-note}
**Note:** The `data` field is called [flexible array member](https://en.wikipedia.org/wiki/Flexible_array_member) and allows us to have extra memory space "appended" to the end of the `struct`. We allocate this data by requesting extra memory to `malloc`. This is a C99 feature, so make sure you compile with `-std=c99` or `-std=gnu99`.

so in the end, the `int *va` pointer is actually a pointer to the `data` inside the `varray_t`:

```c
varray_t va;
int *data = va.data;
```

So how can we retrieve the `varray_t` from the `*data` pointer? Well, we can manually obtain the pointer to the real structure with a clever trick. This is how the `varray_t` actually looks like in memory:

![varray_t](/assets/posts/varray/varray_descripiton.svg)
<center><p style="margin-top: 0; padding-top: 0; color: gray;">
    Note that the user facing pointer is just a pointer to the struct's data.
</p></center>

{: .box-note}
**Note:** When we do `va.data` C is actually getting the `varray_t` position in memory and adding the offset of the `data` field to it. Which could be written as `*(&va + offsetof(varray_t, data))`. The [`offsetof`](https://en.cppreference.com/w/cpp/types/offsetof) macro provides the amount of bytes between the beginning of the `struct` and the field we want to access.

You might have already guessed the answer, which is that we can get the `varray_t` pointer by subtracting the offset of the `data` field from the `data` pointer:

```c
// given a (already initialized) data pointer:
int *data = ...;

varray_t *va = data - offsetof(varray_t, data);
```

That's it, this is the clever trick in which we rely on to hide the `varray_t` and expose only a pointer to the data and this is the reason why we can use it as if it was a native C array.

{: .box-note}
**Note:** this trick of "hiding" some header data before the pointer returned to the user is famously used in `malloc`.

### Memory alignment issues

You might have noticed that the flexible array member in the `varray_t` is of type `uint8_t`. This is because we want to be able to store any type of data in the array, so we use the most granular sized type (i.e. a byte). There is a problem, however, with more complex data types because we need them to be stored in a memory address that is a multiple of its size (see [data alignment](https://en.wikipedia.org/wiki/Data_structure_alignment) for more details). Let's see this with an example:

![varray_t](/assets/posts/varray/address_alignment.svg)
<center><p style="margin-top: 0; padding-top: 0; color: gray;">
    On the left, the memory address and on the right what is used for.
</p></center>

So, in summary, we have to make sure that the `data[]` field is aligned to the size of the largest data type we want to store in the array. If we assume the largest data type is a 64 bit integer, then a possible solution is to add 2 `size_t` fields to the `varray_t` **before** the array:

![varray_t](/assets/posts/varray/varray_memory_layout.svg)

The reason this works is because, in most architectures, `size_t` will be either 4 or 8 bytes long so we get 8 or 16 bytes of alignment, which is enough for any data type we want to store in the array (remember that each `size_t`, will also be aligned itself).

## Interface

Besides the previous explanation, the rest of the implementation focuses on adding some more type safety and some convenience functions.

### `varray_init` and `varray_release`

It's quite simple to implement these functions. To initialize, we will implement the actual logic in an internal function (`_varray_init`) and provide a macro that makes the interface a little more user friendly:
    
```c
/** Returns an initialized var array. The trick is that this function will
 *  return a pointer to the array data and not to the var array structure,
 *  but the array structure can still be accessed by subtracting the size of
 *  the structure from the pointer.
 *
 *  \param elem_size Size of the elements stored in the var array.
 *  \param num_elems Number of initial elements
 *  \return Pointer to the user data.
 */
void *_varray_init( size_t elem_size, size_t num_elems )
{
  if( num_elems == 0 )
    num_elems = 1;

  varray_t *va = malloc( sizeof( varray_t ) + elem_size * num_elems );
  va->capacity = num_elems;
  va->len = 0;

  /* returns a pointer to the user data, not the array structure */
  return va->data;
}
```

and the macro:

```c
/** Initializes a var array with reserved space for the desired number of elements.
 *
 *  \param ptr Normal pointer to the type of the var array.
 *  \param n Number of elements to reserve.
 */
#define varray_init( ptr, n ) ( ( ptr ) = _varray_init( sizeof( *( ptr ) ), n ) )
```
<center><p style="margin-top: 0; padding-top: 0; color: gray;">
    The macro just calculates the `element_size` using `sizeof` so the user doesn't have to.
</p></center>

The release function is also simple:

```c
/** Releases a var array initialized by \a varray_init.
 *
 *  \param ptr Pointer used as var array.
 */
#define varray_release( ptr ) ( free( _va_header( ptr ) ), ( ptr ) = NULL )
```

### Getting the `varray_t` header

This is the key macro that is used by the other ones in order to access the data:

```c
/** Gets the hidden header of a var array. Users will get a pointer to the array data
 *  so we need to subtract the size of the header to get the actual pointer to the
 *  \a varray_t structure.
 *
 *  \param ptr Var array pointer.
 *  \return Pointer to \a varray_t.
 */
#define _va_header( ptr ) \
  ( ( varray_t * )( ( uint8_t * )( ptr ) - offsetof( varray_t, data ) ) )
```
<center><p style="margin-top: 0; padding-top: 0; color: gray;">
    This is just subtracting the header size (`offsetof( varray_t, data )`) from the data pointer `ptr` as explained before.
</p></center>

### `varray_len`

This function returns the number of elements in the array. The implementation is really straightforward. We access the hidden data and return the `len` field:

```c
/** Returns the length of a var array (actual number of elements stored).
 *
 *  \param ptr Pointer used as var array.
 *  \return Var array length.
 *
 *  \note This value may be modified but it shouldn't be increased further than the capacity.
 */
#define varray_len( ptr ) ( _va_header( ptr )->len )
```

### `varray_capacity`

This one returns the capacity (i.e. the reserved memory in element units):

```c
/** Returns the capacity of a var array (number of elements that fit in the buffer).
 *
 *  \param ptr Pointer used as var array.
 *  \return Var array capacity.
 *
 *  \note This value must not be modified (use \a varray_resize).
 */
#define varray_capacity( ptr ) ( _va_header( ptr )->capacity )
```

### `varray_push`

And finally, this is the function that we wanted: it will append elements to the end of the `varray_t` but making sure it grows in order to fit the new elements automatically:

```c
/** Stores an element in the first unused position increasing the length and the capacity
 *  (if required).
 *
 *  \param ptr Pointer used as var array.
 *  \param elem Element to push.
 *
 *  \note \a ptr may be modified by this operation.
 */
#define varray_push( ptr, elem ) \
  ( _resize_if_req( ptr ), ( ptr )[varray_len( ptr )++] = elem )
```

`_resize_if_req` is just a convenience function that will resize the array if the length is equal to the capacity. The algorithm is roughly:

```
varray
if varray.len == varray.capacity:
    new_capacity = varray.capacity * 2
    varray = realloc( varray, new_capacity )
    varray.capacity = new_capacity
```

{: .box-note}
**Note:** instead of increasing the array capacity by 1, we double it so the [amortized cost of adding an element is constant](https://en.wikipedia.org/wiki/Amortized_analysis#:~:text=%5Bedit%5D-,Dynamic%20array,-%5Bedit%5D).

```c
/** Doubles the size of the array if it's full.
 *
 *  \param ptr Var array pointer.
 *  \return Pointer to \a varray_t.
 *
 *  \note This function may redefine \a ptr.
 */
#define _resize_if_req( ptr ) \
  ( ( ptr ) = ( varray_capacity( ptr ) <= varray_len( ptr ) ) ? _va_double_size( ptr ) : ( ptr ) )
```

{: .box-warning}
**Warning:** I mentioned before that this implementation also had its gotchas, and this is one of those: notice that we are using `realloc` to resize the array. This means that the `varray_t` pointer _might_ change when pushing new elements, so the following code could end up in disaster:

```c
int *add_elems( int *va ) {
  varray_push( va, 1 );
  varray_push( va, 1 );
  return va;
}

int *va;
varray_init( va, 1 );

add_elems( va );  // add_elems will likely invalidate the va pointer
```
<center><p style="margin-top: 0; padding-top: 0; color: gray;">
    Notice that <b>varray_push</b> is called inside <b>add_elems</b> so the <b>va</b> so if the pointer is updated by <b>realloc</b> it will only replace the local pointer variable defined in <b>add_elems</b>.
    This means that the original <b>va</b> pointer will still point to the old memory location!!!
</p></center>

The proper usage would to call:

```c
// return the new pointer so we can update the external one
va = add_elems( va );
```

## Last notes

In the previous sections I tried to highlight the most important details about the implementation and left behind some others that I think don't add much (which you can see in the real implementation).

Also, this `varray_t` does not shrink when elements are removed, but this could be easily implemented by adding a `varray_shrink` function that would resize the array to the current length.

That said, I think this data structure balances a nice type safe API that, if used carefully, can help you write simpler C code. Enjoy!
