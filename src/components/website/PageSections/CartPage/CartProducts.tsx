// src/components/website/PageSections/CartPage/CartProducts.tsx

"use client";
import { Trash2, Loader2 } from "lucide-react";
import { useDeleteCart, useGetCart } from "@/lib/hooks/useAddToCart";
import { useSession } from "next-auth/react";
import {
  useCheckoutCart,
  useCheckoutCartInModal,
} from "@/lib/hooks/checkoutCart";
import { useShippingAdd } from "@/lib/hooks/useShippingAdd";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { CartItem } from "@/lib/types/cart";
import { Eye } from "lucide-react";
import CartItemDetailsModal from "./CartItemDetailsModal";

import { useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

const CartProducts = () => {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<CartItem | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [shippingDetails, setShippingDetails] = useState({
    fullName: "",
    company: "",
    email: "",
    phone: "",
    street: "",
    // apartment: "",
    postalCode: "",
    city: "",
    province: "",
    country: "Spain",
  });
  const [shippingComments, setShippingComments] = useState("");
  const [sameAsInvoice, setSameAsInvoice] = useState(true);
  const [step, setStep] = useState<"shipping" | "invoice">("shipping");
  const [invoiceDetails, setInvoiceDetails] = useState({
    name: "",
    company: "",
    vat: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    province: "",
    country: "Spain",
  });
  const { data: session } = useSession();
  const token = session?.accessToken || "";

  // 1. Create Order Mutation
  const { mutate: checkoutCart } = useCheckoutCart({ token });

  // 2. Payment Modal Mutation
  const { mutate: checkoutInModal } = useCheckoutCartInModal({ token });

  // 3. Shipping Address Mutation
  const { mutate: addShippingAddress } = useShippingAdd({ token });

  const { data: cart } = (useGetCart({ token }) as {
    data: { data: CartItem[] } | undefined;
  }) || { data: undefined };

  const { mutate: deleteCartItem } = useDeleteCart({ token });

  const cartItems = useMemo(() => cart?.data || [], [cart?.data]);

  const handleDelete = (id: string) => {
    deleteCartItem(id);
  };

  // 3. Calculate Subtotal, Weight, and Dimensions (for display)
  const { subtotal, totalWeight, maxLength } = useMemo(() => {
    let sub = 0;
    let weight = 0;
    let maxL = 0;

    cartItems.forEach((item) => {
      // Each item.totalAmount already includes its shipping cost (set on product page)
      const itemTotal =
        item.totalAmount ||
        (item.serviceId?.price || item.price || 0) * item.quantity;
      sub += itemTotal;

      // Weight and Length for display purposes
      if (item.product && item.product.selectedFeature) {
        const feature = item.product.selectedFeature;
        const lengthMeters = item.product.unitSize || item.product.range || 0;
        const itemWeight =
          (feature.kgsPerUnit || 0) * lengthMeters * item.quantity;
        weight += itemWeight;
        const lengthMm = lengthMeters * 1000;
        if (lengthMm > maxL) maxL = lengthMm;
      } else if (item.serviceId) {
        const serviceSizes = Object.values(item.serviceId.sizes || {});
        const maxServiceL =
          serviceSizes.length > 0 ? Math.max(...(serviceSizes as number[])) : 0;
        if (maxServiceL > maxL) maxL = maxServiceL;
      } else if (item.serviceData) {
        if (item.serviceData.totalWeight) {
          weight += item.serviceData.totalWeight * item.quantity;
        }
        const length = item.serviceData.totalLength || 0;
        if (length > maxL) maxL = length;
      }
    });

    return { subtotal: sub, totalWeight: weight, maxLength: maxL };
  }, [cartItems]);

  const total = subtotal;

  // Handle Checkout (Create Order)
  const handleCheckout = () => {
    if (!session) {
      toast.error("Please login to place your order.");
      router.push("/login");
      return;
    }
    setIsCreatingOrder(true);
    const startTime = Date.now();

    const payload = {
      type: "cart",
      cartItems: cartItems.map((item) => ({
        cartId: item._id,
      })),
      totalAmount: total,
    };

    console.log(payload);

    checkoutCart(payload, {
      onSuccess: (data: { data?: { _id: string }; _id?: string }) => {
        const createdOrderId = data?.data?._id || data?._id;
        if (createdOrderId) {
          setOrderId(createdOrderId);
        }

        // Ensure loading shows for at least 1 second
        const elapsed = Date.now() - startTime;
        const remainingDelay = Math.max(1000 - elapsed, 0);

        setTimeout(() => {
          setIsCreatingOrder(false);
          setShowModal(true);
        }, remainingDelay);
      },
      onError: (error: Error) => {
        console.error("Failed to create order:", error);

        // Still show loading for at least 1 second even on error
        const elapsed = Date.now() - startTime;
        const remainingDelay = Math.max(1000 - elapsed, 0);

        setTimeout(() => {
          setIsCreatingOrder(false);
        }, remainingDelay);
      },
    });
  };

  // Handle Proceed to Checkout (Payment)
  const handleProceedToCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) {
      console.error("Order ID is missing");
      return;
    }

    if (!session) {
      toast.error("Please login to place your order.");
      router.push("/login");
      return;
    }

    if (step === "shipping") {
      if (!sameAsInvoice) {
        setStep("invoice");
        return;
      }
    }

    setIsProcessingPayment(true);

    const shippingPayload = {
      ...shippingDetails,
      deliveryInstructions: shippingComments,
      orderId: orderId,
      // If sameAsInvoice is false, we might want to include invoice info if the backend supports it
      ...(sameAsInvoice ? {} : { invoiceDetails }),
    };

    console.log("Saving Shipping Address:", shippingPayload);

    addShippingAddress(shippingPayload, {
      onSuccess: () => {
        console.log("Shipping address saved. Proceeding to payment...");
        checkoutInModal(
          {
            orderId: orderId,
            totalAmount: total,
          },
          {
            onSuccess: (data: { data?: { url?: string } }) => {
              if (data?.data?.url) {
                window.location.href = data.data.url;
              } else {
                setIsProcessingPayment(false);
              }
            },
            onError: (error) => {
              console.error("Payment checkout failed:", error);
              setIsProcessingPayment(false);
            },
          },
        );
      },
      onError: (error: unknown) => {
        console.error("Failed to save shipping address:", error);
        setIsProcessingPayment(false);
      },
    });
  };

  return (
    <div className="container mx-auto py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* LEFT: Cart Items */}
      <div className="md:col-span-2 bg-white rounded-xl border p-6">
        {/* Select All + Delete Icon */}
        <div className="flex items-center justify-between mb-6">
          <label className="flex items-center gap-3 text-gray-700">
            {/* <input
              type="checkbox"
              className="w-5 h-5 rounded border-gray-300"
            /> */}
            <span className="text-sm font-medium">
              Productos en el carro de compra {cartItems?.length}
            </span>
          </label>

          {/* <Trash2 className="text-red-500 cursor-pointer" size={20} /> */}
        </div>

        {/* Cart Rows */}
        {cartItems?.map((item) => (
          <div
            key={item._id}
            className="flex items-center justify-between py-6 border-b last:border-none"
          >
            {/* Checkbox + Image + Name */}
            <div className="flex items-center gap-5">
              {/* <input
                type="checkbox"
                className="w-5 h-5 rounded border-gray-300"
              /> */}

              <button
                onClick={() => handleDelete(item._id)}
                className="md:hidden text-red-500 p-2"
                aria-label="Delete item"
              >
                <Trash2 size={18} />
              </button>

              <div className="w-[140px] h-[80px] bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden border border-slate-100">
                {item?.product?.productId?.productImage &&
                  item.product.productId.productImage.length > 0 ? (
                  <Image
                    src={item.product.productId.productImage[0].url}
                    alt={item.product.productId.productName}
                    width={140}
                    height={80}
                    className="w-full h-full object-contain p-2"
                  />
                ) : item?.serviceId?.imageUrl ? (
                  <Image
                    src={item.serviceId.imageUrl}
                    alt={item.serviceId.templateName}
                    width={140}
                    height={80}
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-[10px] text-slate-400 font-medium px-2 text-center uppercase">
                    <span>
                      {item?.serviceId?.templateName ||
                        item?.serviceData?.serviceType ||
                        "Product"}
                    </span>
                    <span>{item?.product?.productId?.productName}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="font-semibold text-gray-800 uppercase">
                  {item?.product?.productId?.productName ||
                    item?.serviceId?.templateName ||
                    item?.serviceData?.serviceType ||
                    "Custom Product"}
                </div>
                {/* eye button for viewing the modal */}
                <motion.button
                  onClick={() => setViewingItem(item)}
                  whileHover="hover"
                  whileTap="tap"
                  variants={{
                    hover: {
                      scale: 1.1,
                      backgroundColor: "rgba(126, 24, 0, 0.05)",
                      color: "#7E1800",
                      boxShadow: "0px 4px 15px rgba(126, 24, 0, 0.1)",
                    },
                    tap: { scale: 0.95 },
                  }}
                  className="p-2 text-slate-400 cursor-pointer bg-slate-100/50 rounded-lg flex items-center justify-center relative overflow-hidden group"
                  title="View Details"
                >
                  <motion.div
                    variants={{
                      hover: { scale: 1.2, rotate: 15 },
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    <Eye size={18} />
                  </motion.div>
                  {/* Sophisticated Shimmer */}
                  <motion.div
                    className="absolute inset-0 bg-linear-to-r from-transparent via-white/60 to-transparent -skew-x-12"
                    variants={{
                      hover: { x: ["-150%", "150%"] },
                    }}
                    transition={{
                      duration: 0.75,
                      repeat: Infinity,
                      repeatDelay: 0.1,
                      ease: "easeInOut",
                    }}
                  />
                </motion.button>
              </div>
            </div>

            {/* Price + Qty */}
            <div className="flex items-center gap-4">
              <div className="font-semibold text-gray-900 text-right">
                €{" "}
                {(
                  item?.totalAmount ||
                  (item?.serviceId?.price || item?.price || 0) * item?.quantity
                ).toFixed(2)}
                <div className="text-[10px] text-gray-500 font-normal">
                  {item?.serviceId?.units ||
                    item?.serviceData?.units ||
                    item?.quantity}{" "}
                  Unidades
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* <button
                  onClick={() => setViewingItem(item)}
                  className="p-2 text-slate-400 hover:text-[#7E1800] transition-colors cursor-pointer bg-slate-50 hover:bg-[#7E1800]/5 rounded-lg"
                  title="View Details"
                >
                  <Eye size={18} />
                </button> */}

                <motion.button
                  onClick={() => handleDelete(item._id)}
                  whileHover="hover"
                  whileTap="tap"
                  variants={{
                    hover: {
                      scale: 1.1,
                      backgroundColor: "rgba(239, 68, 68, 0.05)",
                      color: "#ef4444",
                    },
                    tap: { scale: 0.95 },
                  }}
                  className="p-2 text-slate-400 cursor-pointer bg-slate-100/50 rounded-lg flex items-center justify-center"
                  title="Remove item"
                >
                  <motion.div
                    variants={{
                      hover: { rotate: [0, -10, 10, -10, 10, 0] },
                    }}
                    transition={{ duration: 0.4 }}
                  >
                    <Trash2 size={18} />
                  </motion.div>
                </motion.button>
              </div>
            </div>
          </div>
        ))}

        {cartItems.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            Tu carro está vacío.
          </div>
        )}
      </div>

      {/* RIGHT: Order Summary */}
      <div className="bg-white rounded-xl shadow-sm border p-6 h-max">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">
          Resumen pedido
        </h2>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span>Total Productos ({cartItems.length})</span>
            <span>€ {subtotal.toFixed(2)}</span>
          </div>

          {totalWeight > 0 && (
            <div className="flex justify-between items-center text-gray-500">
              <span className="flex flex-col">
                <span>Transporte</span>
                <span className="text-[10px] text-gray-400">
                  {totalWeight.toFixed(2)}kg • {maxLength / 1000}m max
                </span>
              </span>
              <span className="text-xs italic">Incluido</span>
            </div>
          )}

        </div>

        <hr className="my-5" />

        {/* Total */}
        <div className="flex justify-between text-lg font-semibold mb-6">
          <span>TOTAL</span>
          <span className="text-red-600">€ {total.toFixed(2)}</span>
        </div>

        {/* Button with AlertDialog */}
        <AlertDialog open={showModal} onOpenChange={setShowModal}>
          <AlertDialogTrigger asChild>
            <button
              onClick={handleCheckout}
              disabled={isCreatingOrder || cartItems.length === 0}
              className="w-full rounded-xl bg-[#7E1800] 
                 py-3.5 text-base font-semibold text-white 
                 shadow-lg transition-all duration-200
                 hover:from-red-700 hover:to-red-800 hover:shadow-xl
                 active:scale-[0.98] cursor-pointer
                 disabled:opacity-50 disabled:cursor-not-allowed
                 flex items-center justify-center gap-2"
            >
              {isCreatingOrder ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Creando pedido...</span>
                </>
              ) : (
                "Tramitar pedido"
              )}
            </button>
          </AlertDialogTrigger>

          <AlertDialogContent className="max-w-2xl rounded-2xl p-6">
            <AlertDialogHeader className="space-y-3 text-center">
              {/* Optional icon */}
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <span className="text-xl">🛒</span>
              </div>

              <AlertDialogTitle className="text-xl font-bold text-center uppercase">
                {step === "shipping"
                  ? "INTRODUCE LA DIRECCION DE ENVIO"
                  : "INTRODUCE LOS DATOS DE FACTURACIÓN"}
              </AlertDialogTitle>

              <AlertDialogDescription className="text-sm text-muted-foreground text-center w-3/4 mx-auto">
                Asegurate de que la información es correcta
              </AlertDialogDescription>
            </AlertDialogHeader>

            <form onSubmit={handleProceedToCheckout}>
              <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto px-1 py-2">
                {step === "shipping" ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Nombre</Label>
                        <Input
                          id="fullName"
                          required
                          placeholder="John Doe"
                          value={shippingDetails.fullName}
                          onChange={(e) =>
                            setShippingDetails({
                              ...shippingDetails,
                              fullName: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company">Empresa</Label>
                        <Input
                          id="company"
                          placeholder="Polspoch SL"
                          value={shippingDetails.company}
                          onChange={(e) =>
                            setShippingDetails({
                              ...shippingDetails,
                              company: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          placeholder="john@example.com"
                          value={shippingDetails.email}
                          onChange={(e) =>
                            setShippingDetails({
                              ...shippingDetails,
                              email: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input
                          id="phone"
                          required
                          placeholder="+34 ..."
                          value={shippingDetails.phone}
                          onChange={(e) =>
                            setShippingDetails({
                              ...shippingDetails,
                              phone: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="street">Dirección (Calle, Número, Piso)</Label>
                      <Input
                        id="street"
                        required
                        placeholder="Calle ..."
                        value={shippingDetails.street}
                        onChange={(e) =>
                          setShippingDetails({
                            ...shippingDetails,
                            street: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">
                          Código Postal
                        </Label>
                        <Input
                          id="postalCode"
                          required
                          placeholder="28001"
                          maxLength={5}
                          value={shippingDetails.postalCode}
                          onChange={(e) =>
                            setShippingDetails({
                              ...shippingDetails,
                              postalCode: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">Ciudad</Label>
                        <Input
                          id="city"
                          required
                          placeholder="Madrid"
                          value={shippingDetails.city}
                          onChange={(e) =>
                            setShippingDetails({
                              ...shippingDetails,
                              city: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="province">Provincia</Label>
                        <Input
                          id="province"
                          required
                          placeholder="Madrid"
                          value={shippingDetails.province}
                          onChange={(e) =>
                            setShippingDetails({
                              ...shippingDetails,
                              province: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          placeholder="Spain"
                          value={shippingDetails.country}
                          onChange={(e) =>
                            setShippingDetails({
                              ...shippingDetails,
                              country: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shippingComments">
                        Comentarios envío
                      </Label>
                      <textarea
                        id="shippingComments"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Introduce cualquier información relevante para el envio"
                        value={shippingComments}
                        onChange={(e) => setShippingComments(e.target.value)}
                      />
                    </div>

                    <div className="flex items-center space-x-2 py-2">
                      <input
                        type="checkbox"
                        id="sameAsInvoice"
                        checked={sameAsInvoice}
                        onChange={(e) => setSameAsInvoice(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600 cursor-pointer"
                      />
                      <Label htmlFor="sameAsInvoice" className="cursor-pointer">
                        Mismos datos para la facturación
                      </Label>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="invoiceName">Nombre</Label>
                      <Input
                        id="invoiceName"
                        required
                        placeholder="John Doe"
                        value={invoiceDetails.name}
                        onChange={(e) =>
                          setInvoiceDetails({
                            ...invoiceDetails,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="invoiceCompany">Empresa</Label>
                        <Input
                          id="invoiceCompany"
                          placeholder="Company Name"
                          value={invoiceDetails.company}
                          onChange={(e) =>
                            setInvoiceDetails({
                              ...invoiceDetails,
                              company: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoiceVAT">VAT</Label>
                        <Input
                          id="invoiceVAT"
                          required
                          placeholder="VAT Number"
                          value={invoiceDetails.vat}
                          onChange={(e) =>
                            setInvoiceDetails({
                              ...invoiceDetails,
                              vat: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="invoiceEmail">Email</Label>
                        <Input
                          id="invoiceEmail"
                          type="email"
                          required
                          placeholder="john@example.com"
                          value={invoiceDetails.email}
                          onChange={(e) =>
                            setInvoiceDetails({
                              ...invoiceDetails,
                              email: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoicePhone">Teléfono</Label>
                        <Input
                          id="invoicePhone"
                          required
                          placeholder="+34 ..."
                          value={invoiceDetails.phone}
                          onChange={(e) =>
                            setInvoiceDetails({
                              ...invoiceDetails,
                              phone: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoiceAddress">Dirección (Calle, Número, Piso)</Label>
                      <Input
                        id="invoiceAddress"
                        required
                        placeholder="Calle ..."
                        value={invoiceDetails.address}
                        onChange={(e) =>
                          setInvoiceDetails({
                            ...invoiceDetails,
                            address: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="invoiceCity">Ciudad</Label>
                        <Input
                          id="invoiceCity"
                          required
                          placeholder="Madrid"
                          value={invoiceDetails.city}
                          onChange={(e) =>
                            setInvoiceDetails({
                              ...invoiceDetails,
                              city: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoicePostalCode">Código Postal</Label>
                        <Input
                          id="invoicePostalCode"
                          required
                          placeholder="28001"
                          value={invoiceDetails.postalCode}
                          onChange={(e) =>
                            setInvoiceDetails({
                              ...invoiceDetails,
                              postalCode: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="invoiceProvince">Provincia</Label>
                        <Input
                          id="invoiceProvince"
                          required
                          placeholder="Madrid"
                          value={invoiceDetails.province}
                          onChange={(e) =>
                            setInvoiceDetails({
                              ...invoiceDetails,
                              province: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoiceCountry">Country</Label>
                        <Input
                          id="invoiceCountry"
                          placeholder="Spain"
                          value={invoiceDetails.country}
                          onChange={(e) =>
                            setInvoiceDetails({
                              ...invoiceDetails,
                              country: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <AlertDialogFooter className="mt-4 flex gap-3">
                {step === "invoice" ? (
                  <button
                    type="button"
                    onClick={() => setStep("shipping")}
                    className="flex-1 rounded-xl border border-gray-300 
                       text-gray-700 transition
                       hover:bg-gray-100 cursor-pointer py-2"
                  >
                    Atrás
                  </button>
                ) : (
                  <AlertDialogCancel
                    type="button"
                    className="flex-1 rounded-xl border border-gray-300 
                       text-gray-700 transition
                       hover:bg-gray-100 cursor-pointer"
                  >
                    Cancelar
                  </AlertDialogCancel>
                )}

                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="flex-1 rounded-xl bg-red-700 
                     text-white font-semibold transition
                     hover:bg-red-800 active:scale-[0.98]
                     cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2 py-2"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Procesando...</span>
                    </>
                  ) : step === "shipping" && !sameAsInvoice ? (
                    "Siguiente"
                  ) : (
                    "Ir al pago"
                  )}
                </button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <CartItemDetailsModal
        item={viewingItem}
        isOpen={!!viewingItem}
        onClose={() => setViewingItem(null)}
      />
    </div>
  );
};

export default CartProducts;
