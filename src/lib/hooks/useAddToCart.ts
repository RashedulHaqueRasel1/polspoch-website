// src/lib/hooks/useAddToCart.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addToCart, deleteCart, getCart, AddToCartPayload } from "../api";
import { toast } from "sonner";

interface UseAddToCartOptions {
  token?: string;
}

// add to cart
export const useAddToCart = ({ token }: UseAddToCartOptions) => {
  return useMutation({
    mutationFn: (data: AddToCartPayload) => addToCart(data, token),

    onSuccess: (data) => {
      console.log("Item added to cart successfully:", data);
    },

    // onError: (error) => {
    //   console.error("Failed to add item to cart:", error);
    // },
    onError: () => {
      toast.error("You are not authorized to add to cart");
    },
  });
};

// get cart
export const useGetCart = ({ token }: UseAddToCartOptions) => {
  return useQuery({
    queryKey: ["cart", token],
    queryFn: () => getCart(token),
  });
};

// delete cart
export const useDeleteCart = ({ token }: UseAddToCartOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCart(token, id),

    onSuccess: (data) => {
      console.log("Item deleted from cart successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["cart", token] });
      toast.success("Item removed from cart");
    },

    onError: (error) => {
      console.error("Failed to delete item from cart:", error);
      toast.error("Failed to remove item");
    },
  });
};
