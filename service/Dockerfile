FROM golang:1.22-alpine AS build
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/backend ./cmd/api

FROM gcr.io/distroless/static-debian12
WORKDIR /app

COPY --from=build /bin/backend /backend

ENV PORT=1412
EXPOSE 1412

ENTRYPOINT ["/backend"]
