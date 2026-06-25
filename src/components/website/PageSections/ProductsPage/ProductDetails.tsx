"use client";

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useProduct } from "@/lib/hooks/useProduct";
import {
  ShoppingCart,
  Plus,
  Minus,
  HelpCircle,
  Trash2,
  ListChecks,
  Ruler,
  Loader2,
  Tag,
  Truck,
} from "lucide-react";
import { useAddToCart } from "@/lib/hooks/useAddToCart";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import SelectedConfiguration from "./SelectedConfiguration";
import { Info } from "lucide-react";
import { getOrCreateGuestId } from "@/lib/guestId";
import { useQuery } from "@tanstack/react-query";
import { getShippingPrice } from "@/lib/api";

// Helper tooltips
const TOOLTIPS = {
  thickness:
    "El espesor determina la resistencia del producto. Más grueso = más resistente",
  size1: "Dimensión principal - ancho o diámetro del producto",
  size2:
    "Dimensión secundaria - altura o segunda dimensión (requerida para este producto)",
  finishQuality: `Opciones de calidad de acabado:
• Acabado de fábrica: Estándar (económico)
• Pulido: Brillante (precio medio)
• Galvanizado: Resistente al óxido (uso exterior)
• Recubrimiento en polvo: Color + Duradero (premium)`,
  length:
    "Elige un largo estándar o personalízalo usando el control deslizante",
  shipping:
    "Gasto de envío calculado según el peso y el largo. Mensajería para paquetes de menos de 2,5 m, entrega en camión para artículos más grandes.",
};

// Tooltip component
const Tooltip = ({
  text,
  step,
  showTooltip,
  setShowTooltip,
}: {
  text: string;
  step: string;
  showTooltip: string | null;
  setShowTooltip: (step: string | null) => void;
}) => (
  <div className="relative inline-block">
    <button
      type="button"
      onMouseEnter={() => setShowTooltip(step)}
      onMouseLeave={() => setShowTooltip(null)}
      onClick={() => setShowTooltip(showTooltip === step ? null : step)}
      className="ml-2 text-gray-400 hover:text-[#7E1800]/60 transition-colors"
      aria-label="Help"
    >
      <HelpCircle size={16} />
    </button>
    {showTooltip === step && (
      <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50 whitespace-pre-line">
        {text}
        <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
      </div>
    )}
  </div>
);

// Helper: Get updated 'available' options
const getAvailableOptions = (
  //eslint-disable-next-line
  featureList: any[],
  field: string,
  selections: {
    thickness: number | null;
    size1: number | null;
    size2: number | null;
    finishQuality: string | null;
  },
) => {
  const { thickness, size1, size2, finishQuality } = selections;
  //eslint-disable-next-line
  const options = new Set<any>();

  featureList.forEach((f) => {
    const matchThickness = thickness === null || f.thickness === thickness;
    const matchSize1 = size1 === null || f.size1 === size1;
    const matchSize2 = size2 === null || f.size2 === size2;
    const matchFinish =
      finishQuality === null || f.finishQuality === finishQuality;

    let works = true;
    if (field !== "thickness" && !matchThickness) works = false;
    if (field !== "size1" && !matchSize1) works = false;
    if (field !== "size2" && !matchSize2) works = false;
    if (field !== "finishQuality" && !matchFinish) works = false;

    if (works && f[field] !== undefined && f[field] !== null) {
      options.add(f[field]);
    }
  });

  const arr = Array.from(options);
  if (typeof arr[0] === "number") {
    return arr.sort((a, b) => Number(a) - Number(b));
  }
  return arr.sort();
};

export default function ProductDetails() {
  const params = useParams();
  const productId = params.id as string;

  // Use real data hook
  const { data: product, isLoading, isError, error } = useProduct(productId);

  // Auth and Cart
  const { data: session } = useSession();
  const token = session?.accessToken; // Accessing the custom accessToken property
  const { mutate: addToCartMutate, isPending } = useAddToCart({
    token: token || "",
  });

  const [selectedThickness, setSelectedThickness] = useState<number | null>(
    null,
  );
  const [selectedSize1, setSelectedSize1] = useState<number | null>(null);
  const [selectedSize2, setSelectedSize2] = useState<number | null>(null);
  const [selectedFinishQuality, setSelectedFinishQuality] = useState<
    string | null
  >(null);

  const [selectedUnitSizeMm, setSelectedUnitSizeMm] = useState<number | null>(
    null,
  );
  const [lengthSelectionType, setLengthSelectionType] = useState<
    "standard" | "custom" | null
  >(null);
  const [rangeLengthMm, setRangeLengthMm] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedThumbnail, setSelectedThumbnail] = useState<number>(0);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const [prevProductId, setPrevProductId] = useState<string | null>(null);

  // Adjust state during render to avoid cascading renders in useEffect
  if (product && product._id !== prevProductId) {
    setPrevProductId(product._id);
    // Reset range to 0 (unselected) when product changes
    setRangeLengthMm(0);
    setSelectedThumbnail(0);
    setSelectedThickness(null);
    setSelectedSize1(null);
    setSelectedSize2(null);
    setSelectedFinishQuality(null);
    setSelectedUnitSizeMm(null);
    setLengthSelectionType(null);
  }

  const featureList = useMemo(() => product?.features || [], [product]);

  const allSize1s = useMemo(() => {
    const all = new Set<number>();
    featureList.forEach((f) => f.size1 && all.add(f.size1));
    return Array.from(all).sort((a, b) => a - b);
  }, [featureList]);

  const allThicknesses = useMemo(() => {
    const all = new Set<number>();
    featureList.forEach((f) => {
      if (f.thickness && f.thickness > 0) {
        all.add(f.thickness);
      }
    });
    return Array.from(all).sort((a, b) => a - b);
  }, [featureList]);

  const allFinishQualities = useMemo(() => {
    const all = new Set<string>();
    featureList.forEach((f) => f.finishQuality && all.add(f.finishQuality));
    return Array.from(all).sort();
  }, [featureList]);

  const hasSize2 = useMemo(
    () => featureList.some((f) => !!f.size2),
    [featureList],
  );

  const allSize2s = useMemo(() => {
    const all = new Set<number>();
    featureList.forEach((f) => f.size2 && all.add(f.size2));
    return Array.from(all).sort((a, b) => a - b);
  }, [featureList]);

  const availableThicknesses = useMemo(
    () =>
      getAvailableOptions(featureList, "thickness", {
        thickness: null,
        size1: selectedSize1,
        size2: selectedSize2,
        finishQuality: selectedFinishQuality,
      }),
    [featureList, selectedSize1, selectedSize2, selectedFinishQuality],
  );

  const availableSize1s = useMemo(
    () =>
      getAvailableOptions(featureList, "size1", {
        thickness: selectedThickness,
        size1: null,
        size2: selectedSize2,
        finishQuality: selectedFinishQuality,
      }),
    [featureList, selectedThickness, selectedSize2, selectedFinishQuality],
  );

  const availableSize2s = useMemo(
    () =>
      getAvailableOptions(featureList, "size2", {
        thickness: selectedThickness,
        size1: selectedSize1,
        size2: null,
        finishQuality: selectedFinishQuality,
      }),
    [featureList, selectedThickness, selectedSize1, selectedFinishQuality],
  );

  const availableFinishQualities = useMemo(
    () =>
      getAvailableOptions(featureList, "finishQuality", {
        thickness: selectedThickness,
        size1: selectedSize1,
        size2: selectedSize2,
        finishQuality: null,
      }),
    [featureList, selectedThickness, selectedSize1, selectedSize2],
  );

  const handleSelectionChange = (
    field: "thickness" | "size1" | "size2" | "finishQuality",
    value: number | string | null,
  ) => {
    let newThickness =
      field === "thickness" ? (value as number | null) : selectedThickness;
    let newSize1 = field === "size1" ? (value as number | null) : selectedSize1;
    let newSize2 = field === "size2" ? (value as number | null) : selectedSize2;
    let newFinish =
      field === "finishQuality"
        ? (value as string | null)
        : selectedFinishQuality;

    const validate = (f: "thickness" | "size1" | "size2" | "finishQuality") => {
      if (f === field) return;

      const currentVal =
        f === "thickness"
          ? newThickness
          : f === "size1"
            ? newSize1
            : f === "size2"
              ? newSize2
              : newFinish;
      if (currentVal === null) return;

      const available = getAvailableOptions(featureList, f, {
        thickness: newThickness,
        size1: newSize1,
        size2: newSize2,
        finishQuality: newFinish,
      });

      if (!available.includes(currentVal)) {
        if (f === "thickness") newThickness = null;
        if (f === "size1") newSize1 = null;
        if (f === "size2") newSize2 = null;
        if (f === "finishQuality") newFinish = null;
      }
    };

    (["thickness", "size1", "size2", "finishQuality"] as const).forEach(
      validate,
    );

    if (newThickness !== selectedThickness) setSelectedThickness(newThickness);
    if (newSize1 !== selectedSize1) setSelectedSize1(newSize1);
    if (newSize2 !== selectedSize2) setSelectedSize2(newSize2);
    if (newFinish !== selectedFinishQuality)
      setSelectedFinishQuality(newFinish);

    // Update range if the new selected feature has a different min/max
    const newFeature = featureList.find(
      (f) =>
        f.thickness === newThickness &&
        f.size1 === newSize1 &&
        f.size2 === newSize2 &&
        f.finishQuality === newFinish,
    );

    if (newFeature) {
      const minVal = newFeature.minRange ?? product?.minRange ?? 0;
      const maxVal = newFeature.maxRange ?? product?.maxRange ?? 0;

      if (rangeLengthMm < minVal) {
        setRangeLengthMm(minVal);
      } else if (rangeLengthMm > maxVal) {
        setRangeLengthMm(maxVal);
      }
    }
  };

  const selectedFeature = useMemo(() => {
    if (!product?.features) return null;

    const needsThickness = allThicknesses.length > 0;
    const needsSize1 = allSize1s.length > 0;
    const needsSize2 = hasSize2 && allSize2s.length > 0;
    const needsFinish = allFinishQualities.length > 0;

    if (
      (needsThickness && selectedThickness === null) ||
      (needsSize1 && selectedSize1 === null) ||
      (needsSize2 && selectedSize2 === null) ||
      (needsFinish && selectedFinishQuality === null)
    ) {
      return null;
    }

    return (
      product.features.find(
        (f) =>
          (!needsThickness || f.thickness === selectedThickness) &&
          (!needsSize1 || f.size1 === selectedSize1) &&
          (!needsSize2 || f.size2 === selectedSize2) &&
          (!needsFinish || f.finishQuality === selectedFinishQuality),
      ) || null
    );
  }, [
    product,
    selectedThickness,
    selectedSize1,
    selectedSize2,
    selectedFinishQuality,
    allThicknesses,
    allSize1s,
    hasSize2,
    allSize2s,
    allFinishQualities,
  ]);

  const hasRange = useMemo(() => {
    //eslint-disable-next-line
    const checkValue = (val: any) => typeof val === "number" && val > 0;
    if (selectedFeature) {
      return (
        checkValue(selectedFeature.minRange) ||
        checkValue(selectedFeature.maxRange)
      );
    }
    return (
      featureList.some(
        (f) => checkValue(f.minRange) || checkValue(f.maxRange),
      ) ||
      checkValue(product?.minRange) ||
      checkValue(product?.maxRange)
    );
  }, [selectedFeature, featureList, product]);

  const hasAnyLengthOption = useMemo(() => {
    return (
      hasRange || featureList.some((f) => f.unitSizes && f.unitSizes.length > 0)
    );
  }, [hasRange, featureList]);

  // Priority: Selected Unit > Custom Range > Fallback (1000mm or minRange)
  const effectiveLengthMm = useMemo(() => {
    // 1. User selected a standard unit
    if (lengthSelectionType === "standard" && selectedUnitSizeMm !== null) {
      return selectedUnitSizeMm;
    }

    // 2. User selected a custom range
    if (lengthSelectionType === "custom" && rangeLengthMm > 0) {
      return rangeLengthMm;
    }

    // 3. Fallback logic
    if (rangeLengthMm > 0) return rangeLengthMm;
    const min = selectedFeature?.minRange ?? product?.minRange ?? 0;
    // If min > 1000, use min. Otherwise 1000.
    return min > 1000 ? min : 1000;
  }, [lengthSelectionType, selectedUnitSizeMm, rangeLengthMm, selectedFeature, product]);

  const isUsingFallbackLength = useMemo(() => {
    return lengthSelectionType === null;
  }, [lengthSelectionType]);

  const availableUnitSizes = useMemo(
    () => selectedFeature?.unitSizes || [],
    [selectedFeature],
  );

  const singleUnitWeight = useMemo(() => {
    if (!selectedFeature) return 0;
    const kgsPerUnit = selectedFeature.kgsPerUnit ?? 0;
    const meters = effectiveLengthMm / 1000;
    return kgsPerUnit * meters;
  }, [selectedFeature, effectiveLengthMm]);

  const totalWeight = useMemo(() => {
    return singleUnitWeight * quantity;
  }, [singleUnitWeight, quantity]);

  const { data: shippingData, isFetching: isShippingLoading } = useQuery({
    queryKey: ["shippingQuote", totalWeight, effectiveLengthMm],
    queryFn: () => getShippingPrice({ totalWeight, maxDimension: effectiveLengthMm }),
    enabled: !!selectedFeature && totalWeight > 0 && effectiveLengthMm > 0,
  });

  const shippingCost = shippingData?.shippingPrice || 0;
  const shippingMethod = shippingData?.shippingStatus?.method || "courier";

  const productPrice = useMemo(() => {
    if (!selectedFeature) return 0;
    const pricePerMeter = selectedFeature.miterPerUnitPrice ?? 0;
    const meters = effectiveLengthMm / 1000;
    return pricePerMeter * meters * quantity;
  }, [selectedFeature, effectiveLengthMm, quantity]);

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setRangeLengthMm(val);
    setSelectedUnitSizeMm(null);
    setLengthSelectionType("custom");
  };

  const handleUnitSizeSelect = (size: number) => {
    if (selectedUnitSizeMm === size) {
      setSelectedUnitSizeMm(null);
      setLengthSelectionType(null);
    } else {
      setSelectedUnitSizeMm(size);
      setLengthSelectionType("standard");
    }
  };

  const handleClearFilters = () => {
    setSelectedThickness(null);
    setSelectedSize1(null);
    setSelectedSize2(null);
    setSelectedFinishQuality(null);
    setSelectedUnitSizeMm(null);
    setLengthSelectionType(null);
    const initialMinRange =
      product?.features?.[0]?.minRange ?? product?.minRange ?? 0;
    setRangeLengthMm(initialMinRange);
  };

  const canCheckout =
    !!selectedFeature &&
    quantity > 0 &&
    (hasAnyLengthOption ? lengthSelectionType !== null : true) &&
    !isShippingLoading;

  const hasAnySelection =
    selectedThickness ||
    selectedSize1 ||
    selectedSize2 ||
    selectedFinishQuality;

  const [showUnauthorizedModal, setShowUnauthorizedModal] = useState(false);

  const handleAddToCart = () => {
    if (!canCheckout || !product) return;

    // Calculate unit price (price for 1 item)
    const pricePerMeter = selectedFeature?.miterPerUnitPrice ?? 0;
    // Use effectiveLengthMm which handles the fallback logic correctly
    const lengthMeters = effectiveLengthMm / 1000;
    const unitPrice = pricePerMeter * lengthMeters;

    const payload = {
      type: "product",
      quantity,
      price: Number(unitPrice.toFixed(2)),
      product: {
        productId: product._id,
        featuredId: selectedFeature?._id,
        size: selectedFeature?.size1,
        size2: selectedFeature?.size2,
        thickness: selectedFeature?.thickness,
        finishQualitySelected: selectedFeature?.finishQuality,
        // Send unitSize if explicitly selected, otherwise undefined
        unitSize: lengthSelectionType === "standard" && selectedUnitSizeMm ? selectedUnitSizeMm / 1000 : undefined,
        // Send range if explicitly selected OR if falling back (when no options exist)
        range: lengthSelectionType === "custom"
          ? rangeLengthMm / 1000
          : (!hasAnyLengthOption ? effectiveLengthMm / 1000 : undefined),
        // Always send the effective length (Personalización del largo) in mm
        length: effectiveLengthMm,
        totalWeight: Number(totalWeight.toFixed(2)),
        maxDimensionDetected: effectiveLengthMm,
        shippingPrice: Number(shippingCost.toFixed(2)),
        shippingMethod,
        basePrice: Number(unitPrice.toFixed(2)),
        miterPerUnitPrice: selectedFeature?.miterPerUnitPrice,
        calculatedPrice: Number(productPrice.toFixed(2)),
      },
      totalAmount: Number(productPrice.toFixed(2)),
      userId: session?.user?.id,
      guestId: !session?.user?.id ? getOrCreateGuestId() : undefined,
    };

    console.log("Selected Configuration to Add to Cart:", {
      "Producto": product.productName,
      "Ancho / Diámetro": selectedSize1,
      "Altura / Segunda medida": selectedSize2,
      "Espesor": selectedThickness,
      "Calidad / Acabado": selectedFinishQuality,
      "Largo seleccionado (mm)": effectiveLengthMm,
      "Tipo de largo": lengthSelectionType === "standard" ? "Largo estándar" : "Largo personalizado",
      "Cantidad": quantity,
      "Precio unitario": Number(unitPrice.toFixed(2)),
      "Precio total productos": Number(productPrice.toFixed(2)),
      "Envío estimado": Number(shippingCost.toFixed(2)),
    });

    addToCartMutate(payload, {
      onSuccess: () => {
        toast.success("Added to cart successfully!");
        handleClearFilters();
        setQuantity(1);
      },
      // onError: (err: { message?: string }) => {
      //   toast.error(err?.message || "Failed to add to cart");
      // },
      onError: () => {
        setShowUnauthorizedModal(true);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-transparent py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT: Image Skeleton */}
            <div className="lg:col-span-5">
              <div className="sticky top-8">
                <Skeleton className="w-full h-[500px] rounded-2xl" />

                <div className="mt-4 flex gap-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="w-24 h-24 rounded-xl" />
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: Details Skeleton */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-[#7E1800]/10 space-y-6">
                {/* Title */}
                <div className="space-y-3">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>

                {/* Option Blocks */}
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="p-5 rounded-xl border-2 border-[#7E1800]/20 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-12" />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[...Array(6)].map((_, j) => (
                        <Skeleton
                          key={j}
                          className="h-10 w-[70px] rounded-lg"
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Price Summary */}
                <div className="p-5 rounded-xl border-2 border-[#7E1800]/20 space-y-3">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-8 w-1/3" />
                </div>

                {/* Add to Cart Button */}
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md mx-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Producto no encontrado
          </h2>
          <p className="text-gray-600 mb-6">
            {error?.message ||
              "No hemos podido encontrar el producto que busca."}
          </p>
          <Link
            href="/products"
            className="inline-block px-6 py-3 bg-[#7E1800] text-white rounded-lg font-medium hover:bg-[#7E1800]/90 transition-colors"
          >
            Ver todos los productos
          </Link>
        </div>
      </div>
    );
  }


  return (<>
    {showUnauthorizedModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            Unauthorized
          </h2>

          <p className="text-gray-600 mb-6">
            You are not authorized to add products to the cart.
            Please login with an authorized account.
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowUnauthorizedModal(false)}
              className="px-4 py-2 border rounded-lg"
            >
              Close
            </button>

            <Link
              href="/login"
              className="px-4 py-2 bg-[#7E1800] text-white rounded-lg"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    )}

    <div className="min-h-screen bg-transparent py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT: Image Section */}
          <div className="lg:col-span-5">
            <div className="sticky top-8">
              <div className="rounded-2xl overflow-hidden border-2 border-[#7E1800]/20 bg-white shadow-xl hover:shadow-2xl transition-shadow duration-300">
                <div className="relative w-full h-[500px] bg-transparent">
                  {product.productImage?.[selectedThumbnail]?.url ? (
                    <Image
                      src={product.productImage[selectedThumbnail].url}
                      alt={product.productName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      Sin imagen
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex gap-3 overflow-x-auto p-5">
                {product.productImage?.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedThumbnail(idx)}
                    className={`relative w-24 h-24 rounded-xl overflow-hidden border-3 shrink-0 transition-all duration-200 ${selectedThumbnail === idx
                      ? "border-[#7E1800] shadow-lg scale-105 ring-2 ring-[#7E1800]/30"
                      : "border-[#7E1800]/20 hover:border-[#7E1800]/40 hover:scale-102"
                      }`}
                  >
                    <Image
                      src={img.url}
                      alt={`${product.productName}-${idx}`}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Configuration */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-[#7E1800]/10">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {product.productName}
                  </h1>
                  <p className="text-gray-600 leading-relaxed">
                    {product.productDescription}
                  </p>
                </div>
              </div>

              {/* Clear Filters Button */}
              {hasAnySelection && (
                <div className="flex justify-end mb-4">
                  <button
                    onClick={handleClearFilters}
                    className="flex items-center gap-2 text-sm text-[#7E1800] hover:text-[#7E1800]/80 font-medium px-4 py-2 rounded-lg hover:bg-[#7E1800]/5 transition-all border border-[#7E1800]/20"
                  >
                    <Trash2 size={16} />
                    Borrar filtros
                  </button>
                </div>
              )}

              {/* Selection Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                {/* Size 1 (Width) */}
                <div className="p-4 bg-gradient-to-br from-[#7E1800]/5 via-amber-50 to-white rounded-xl border-2 border-[#7E1800]/10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Ancho / Diámetro
                      </h3>
                      <Tooltip
                        text={TOOLTIPS.size1}
                        step="size1"
                        showTooltip={showTooltip}
                        setShowTooltip={setShowTooltip}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium">
                      en mm
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allSize1s.map((size) => {
                      const isAvailable = availableSize1s.includes(size);
                      const isSelected = selectedSize1 === size;
                      return (
                        <button
                          key={size}
                          onClick={() =>
                            handleSelectionChange(
                              "size1",
                              isSelected ? null : size,
                            )
                          }
                          disabled={!isAvailable && !isSelected}
                          className={`min-w-[60px] px-3 py-2 rounded-lg font-medium text-xs transition-all ${isSelected
                            ? "bg-[#7E1800] text-white shadow-lg scale-105 ring-2 ring-[#7E1800]/30"
                            : isAvailable
                              ? "bg-white border border-[#7E1800]/20 text-gray-700 hover:border-[#7E1800]/40 hover:shadow-sm"
                              : "bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed opacity-50"
                            }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Size 2 (Height) - if applicable */}
                {hasSize2 && (
                  <div className="p-4 bg-gradient-to-br from-[#7E1800]/5 via-amber-50/30 to-white rounded-xl border-2 border-[#7E1800]/10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">
                          Altura / Segunda medida
                        </h3>
                        <Tooltip
                          text={TOOLTIPS.size2}
                          step="size2"
                          showTooltip={showTooltip}
                          setShowTooltip={setShowTooltip}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium">
                        en mm
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allSize2s.map((size) => {
                        const isAvailable = availableSize2s.includes(size);
                        const isSelected = selectedSize2 === size;
                        return (
                          <button
                            key={size}
                            onClick={() =>
                              handleSelectionChange(
                                "size2",
                                isSelected ? null : size,
                              )
                            }
                            disabled={!isAvailable && !isSelected}
                            className={`min-w-[60px] px-3 py-2 rounded-lg font-medium text-xs transition-all ${isSelected
                              ? "bg-[#7E1800] text-white shadow-lg scale-105 ring-2 ring-[#7E1800]/30"
                              : isAvailable
                                ? "bg-white border border-[#7E1800]/20 text-gray-700 hover:border-[#7E1800]/40 hover:shadow-sm"
                                : "bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed opacity-50"
                              }`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Thickness */}
                {allThicknesses.length > 0 && (
                  <div className="p-4 bg-gradient-to-br from-[#7E1800]/5 via-white to-white rounded-xl border-2 border-[#7E1800]/10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">
                          Espesor
                        </h3>
                        <Tooltip
                          text={TOOLTIPS.thickness}
                          step="thickness"
                          showTooltip={showTooltip}
                          setShowTooltip={setShowTooltip}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium">
                        en mm
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allThicknesses.map((thickness) => {
                        const isAvailable =
                          availableThicknesses.includes(thickness);
                        const isSelected = selectedThickness === thickness;
                        return (
                          <button
                            key={thickness}
                            onClick={() =>
                              handleSelectionChange(
                                "thickness",
                                isSelected ? null : thickness,
                              )
                            }
                            disabled={!isAvailable && !isSelected}
                            className={`min-w-[60px] px-3 py-2 rounded-lg font-medium text-xs transition-all ${isSelected
                              ? "bg-[#7E1800] text-white shadow-lg scale-105 ring-2 ring-[#7E1800]/30"
                              : isAvailable
                                ? "bg-white border border-[#7E1800]/20 text-gray-700 hover:border-[#7E1800]/40 hover:shadow-sm"
                                : "bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed opacity-50"
                              }`}
                          >
                            {thickness}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Finish Quality */}
                <div className="p-4 bg-gradient-to-br from-[#7E1800]/5 via-white to-white rounded-xl border-2 border-[#7E1800]/10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Calidad / Acabado
                      </h3>
                      <Tooltip
                        text={TOOLTIPS.finishQuality}
                        step="finishQuality"
                        showTooltip={showTooltip}
                        setShowTooltip={setShowTooltip}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allFinishQualities.map((quality) => {
                      const isAvailable =
                        availableFinishQualities.includes(quality);
                      const isSelected = selectedFinishQuality === quality;
                      return (
                        <button
                          key={quality}
                          onClick={() =>
                            handleSelectionChange(
                              "finishQuality",
                              isSelected ? null : quality,
                            )
                          }
                          disabled={!isAvailable && !isSelected}
                          className={`px-3 py-2 rounded-lg font-medium text-xs transition-all ${isSelected
                            ? "bg-[#7E1800] text-white shadow-lg scale-105 ring-2 ring-[#7E1800]/30"
                            : isAvailable
                              ? "bg-white border border-[#7E1800]/20 text-gray-700 hover:border-[#7E1800]/40 hover:shadow-sm"
                              : "bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed opacity-50"
                            }`}
                        >
                          {quality}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Length Selection */}
                {hasAnyLengthOption && (
                  <div className="p-4 bg-gradient-to-br from-[#7E1800]/5 via-white to-white rounded-xl border-2 border-[#7E1800]/10 lg:col-span-2">
                    <div className="flex items-center mb-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">
                          Personalización del largo
                        </h3>
                        <Tooltip
                          text={TOOLTIPS.length}
                          step="length"
                          showTooltip={showTooltip}
                          setShowTooltip={setShowTooltip}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {!selectedFeature ? (
                        <div className="col-span-2 py-4 text-center border-2 border-dashed border-[#7E1800]/10 rounded-lg bg-[#7E1800]/5">
                          <p className="text-sm font-medium text-[#7E1800]/60">
                            Seleccione el ancho y la calidad anteriores para ver
                            los largos disponibles
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Standard Lengths */}
                          {availableUnitSizes.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <ListChecks
                                  size={16}
                                  className="text-[#7E1800]/80"
                                />
                                <span className="text-xs font-semibold text-gray-700">
                                  Largo estándar
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {availableUnitSizes.map((size) => (
                                  <button
                                    key={size}
                                    onClick={() => handleUnitSizeSelect(size)}
                                    className={`px-4 py-2 rounded-lg font-medium text-xs transition-all ${selectedUnitSizeMm === size
                                      ? "bg-[#7E1800] text-white shadow-lg scale-105 ring-2 ring-[#7E1800]/30"
                                      : "bg-white border border-[#7E1800]/20 text-gray-700 hover:border-[#7E1800]/40 hover:shadow-sm"
                                      }`}
                                  >
                                    {size}mm
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Custom Length in millimeters */}
                          {hasRange && (
                            <div
                              className={
                                availableUnitSizes.length === 0
                                  ? "col-span-2"
                                  : ""
                              }
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <Ruler
                                  size={16}
                                  className="text-[#7E1800]/80"
                                />
                                <span className="text-xs font-semibold text-gray-700">
                                  Largo personalizado
                                </span>
                              </div>

                              <div className="space-y-3">
                                {/* Slider */}
                                <input
                                  type="range"
                                  min={
                                    selectedFeature?.minRange ??
                                    product?.features?.[0]?.minRange ??
                                    product?.minRange ??
                                    0
                                  }
                                  max={
                                    selectedFeature?.maxRange ??
                                    product?.features?.[0]?.maxRange ??
                                    product?.maxRange ??
                                    0
                                  }
                                  step={100}
                                  value={rangeLengthMm}
                                  onChange={handleRangeChange}
                                  className="w-full h-1.5 bg-[#7E1800]/10 rounded-lg appearance-none cursor-pointer accent-[#7E1800]"
                                />

                                {/* Number Input */}
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 flex items-center border border-[#7E1800]/20 rounded-lg bg-white overflow-hidden focus-within:border-[#7E1800] transition-colors">
                                    <input
                                      type="number"
                                      min={
                                        selectedFeature?.minRange ??
                                        product?.features?.[0]?.minRange ??
                                        product?.minRange ??
                                        0
                                      }
                                      max={
                                        selectedFeature?.maxRange ??
                                        product?.features?.[0]?.maxRange ??
                                        product?.maxRange ??
                                        0
                                      }
                                      step={100}
                                      value={rangeLengthMm}
                                      onChange={handleRangeChange}
                                      className="flex-1 px-3 py-2 text-center text-sm font-medium focus:outline-none"
                                    />
                                    <span className="px-3 text-xs text-gray-600 font-medium bg-[#7E1800]/5 h-full flex items-center border-l border-[#7E1800]/20">
                                      mm
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-gray-500 whitespace-nowrap">
                                    Rango:{" "}
                                    {selectedFeature?.minRange ??
                                      product?.features?.[0]?.minRange ??
                                      product?.minRange ??
                                      0}
                                    mm -{" "}
                                    {selectedFeature?.maxRange ??
                                      product?.features?.[0]?.maxRange ??
                                      product?.maxRange ??
                                      0}
                                    mm
                                  </div>
                                </div>

                                {/* Confirm/Use custom length button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLengthSelectionType("custom");
                                    setSelectedUnitSizeMm(null);
                                  }}
                                  className={`w-full py-2 px-3 rounded-lg font-semibold text-xs transition-all ${lengthSelectionType === "custom"
                                    ? "bg-[#7E1800] text-white shadow-md scale-102 ring-2 ring-[#7E1800]/30"
                                    : "bg-white border border-[#7E1800]/20 text-[#7E1800] hover:bg-[#7E1800]/5 hover:border-[#7E1800]/30"
                                    }`}
                                >
                                  {lengthSelectionType === "custom"
                                    ? `Largo personalizado seleccionado: ${rangeLengthMm}mm`
                                    : `Seleccionar largo de ${rangeLengthMm}mm`}
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Configuration Summary */}
              {selectedFeature && (
                <SelectedConfiguration
                  selectedFeature={selectedFeature}
                  measureUnit={product.measureUnit}
                />
              )}

              {/* Product Price */}
              {selectedFeature && (
                <div className="mb-4 mt-4 p-5 rounded-xl border-2 border-[#7E1800]/20 bg-gradient-to-br from-[#7E1800]/5 to-white">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-base font-semibold text-gray-900">
                      Precio del producto
                    </h3>
                  </div>
                  <div className="p-4 rounded-lg border-2 border-[#7E1800]/10 bg-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#7E1800]/10 flex items-center justify-center text-[#7E1800]">
                        <Tag size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-base text-gray-800">
                          Total productos
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Basado en medidas y cantidad
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        €{productPrice.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {quantity} unidad{quantity > 1 ? "es" : ""}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Shipping Method */}
              {selectedFeature && (
                <div className="mb-6 mt-4 p-5 rounded-xl border-2 border-[#7E1800]/20 bg-gradient-to-br from-[#7E1800]/5 to-white">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-base font-semibold text-gray-900">
                      Estimación de envío
                    </h3>
                    <span className="text-xs text-gray-500">
                      Informativa
                    </span>
                    <Tooltip
                      text={TOOLTIPS.shipping}
                      step="shipping"
                      showTooltip={showTooltip}
                      setShowTooltip={setShowTooltip}
                    />
                  </div>
                  <div
                    className={`relative p-4 rounded-lg border-2 flex items-center justify-between transition-all ${shippingMethod === "courier"
                      ? "bg-green-50 border-green-300"
                      : "bg-blue-50 border-blue-300"
                      } ${isShippingLoading ? "opacity-60" : ""}`}
                  >
                    <div
                      className={`absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px] rounded-lg z-10 transition-opacity ${isShippingLoading ? "opacity-100" : "opacity-0 pointer-events-none"
                        }`}
                    >
                      <Loader2 className="w-6 h-6 animate-spin text-[#7E1800]" />
                    </div>
                    <div>
                      <div className={`font-bold text-base flex items-center gap-2 ${shippingMethod === "courier" ? "text-green-800" : "text-blue-800"}`}>
                        <Truck className="h-4 w-4" />
                        {shippingMethod === "courier"
                          ? "Servicio de mensajería"
                          : "Envío en camión"}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {shippingMethod === "courier"
                          ? "Paquete estándar (≤ 2,5 m)"
                          : "Carga grande (> 2,5 m)"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-2xl font-bold ${shippingMethod === "courier" ? "text-green-700" : "text-blue-700"}`}
                      >
                        €{shippingCost.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        No incluido en el precio del producto
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quantity and Pricing */}
              <div className="border-t-2 border-[#7E1800]/20 pt-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
                  {/* Quantity */}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700 mb-2">
                      Cantidad
                    </span>
                    <div className="flex items-center border-2 border-[#7E1800]/20 rounded-lg overflow-hidden bg-white">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="px-4 py-3 hover:bg-[#7E1800]/5 transition-colors border-r-2 border-[#7E1800]/20"
                      >
                        <Minus size={18} />
                      </button>
                      <span className="px-6 py-3 text-lg font-bold min-w-[4rem] text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity((q) => q + 1)}
                        className="px-4 py-3 hover:bg-[#7E1800]/5 transition-colors border-l-2 border-[#7E1800]/20"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Price Breakdown */}
                  {selectedFeature && (
                    <div className="flex-1 bg-gradient-to-br from-[#7E1800]/5 to-white p-4 mt-6 rounded-xl border-2 border-[#7E1800]/10">
                      {/* Hint for fallback pricing */}
                      {isUsingFallbackLength && hasAnyLengthOption && (
                        <div className="mb-2 p-2 bg-yellow-50 text-yellow-700 text-xs rounded border border-yellow-200">
                          Precio mostrado para el largo de {effectiveLengthMm}mm
                          hasta que se seleccione un largo
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-900">
                          Total productos:
                        </span>
                        <span className="text-2xl font-bold text-[#7E1800]">
                          €{productPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Shipping Warning Text */}
                {selectedFeature && (
                  <div className="mb-6 p-4 rounded-xl border border-red-100 bg-red-50/50 flex gap-3 text-xs leading-relaxed text-red-600 font-medium">
                    <Info size={16} className="shrink-0 mt-0.5" />
                    <p>
                      El importe de gastos de envío es una estimación para este
                      producto según las medidas seleccionadas. En caso de pedir
                      varios productos los gastos se agrupan y no se cobran por
                      duplicado. Selecciona todos los productos y visita la
                      página de{" "}
                      <Link
                        href="/cart"
                        className="underline font-bold hover:text-red-700"
                      >
                        check out
                      </Link>{" "}
                      para ver importe total.
                    </p>
                  </div>
                )}

                {/* Add to Cart Button */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleAddToCart}
                    disabled={!canCheckout || isPending || isShippingLoading}
                    className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold text-lg transition-all ${canCheckout && !isPending && !isShippingLoading
                      ? "bg-gradient-to-r from-[#7E1800] to-[#7E1800]/80 text-white hover:from-[#7E1800]/80 hover:to-[#7E1800] shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                  >
                    <span className="relative h-[22px] w-[22px] shrink-0">
                      <Loader2
                        className={`absolute inset-0 animate-spin transition-opacity ${isPending ? "opacity-100" : "opacity-0"
                          }`}
                        size={22}
                        aria-hidden={!isPending}
                      />
                      <ShoppingCart
                        className={`absolute inset-0 transition-opacity ${isPending ? "opacity-0" : "opacity-100"
                          }`}
                        size={22}
                        aria-hidden={isPending}
                      />
                    </span>
                    <span>
                      {isPending
                        ? "Añadiendo..."
                        : isShippingLoading
                          ? "Calculando envío..."
                          : canCheckout
                            ? "Añadir al carro"
                            : !selectedFeature
                              ? "Seleccione las opciones anteriores"
                              : "Seleccione el largo para continuar"}
                    </span>
                  </button>

                  {selectedFeature && lengthSelectionType === null && (
                    <p className="text-center text-xs font-medium text-[#7E1800] animate-pulse">
                      Elija un largo estándar o confirme el largo personalizado para continuar
                    </p>
                  )}
                </div>

                {!selectedFeature && (
                  <p className="text-center text-sm text-gray-500 mt-3">
                    Elija las opciones de cada categoría anterior para ver el
                    precio y añadir al carrito
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
  );
}
